import { prisma } from '../db/prisma.js';
import { moolreClient, NotificationClient, TransferClient } from '../integrations/index.js';
import {
  NotFoundError,
  FulfillmentAlreadyDeliveredError,
  InvalidStateTransitionError,
} from '../errors/index.js';
import { VendorFulfillment } from '@prisma/client';

interface RawVendor {
  id: string;
  name: string;
  phone: string;
  momoChannel: 'mtn' | 'telecel' | 'at';
}

interface RawProduct {
  id: string;
  name: string;
}

export class FulfillmentService {
  constructor(
    private notificationClient: NotificationClient,
    private transferClient: TransferClient,
  ) {}
  /**
   * Processes the paid status of an order:
   * - Queries order details and items.
   * - Resolves vendor phone/details via raw DB query.
   * - Dispatches SMS notification to the vendor via Moolre.
   * - Registers the VendorFulfillment record.
   * - Transitions order to 'vendor_notified'.
   */
  async processOrderPaid(orderId: string): Promise<void> {
    // Check if fulfillment already exists for this order to prevent duplicate SMS/records (idempotency)
    const existing = await prisma.vendorFulfillment.findFirst({
      where: { orderId },
    });
    if (existing) {
      console.log(`Fulfillment already exists for order ${orderId}, skipping SMS/creation.`);
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const orderItems = order.orderItems;
    if (orderItems.length === 0) {
      throw new Error(`No items found in order: ${orderId}`);
    }

    // In single-vendor matching (v1), retrieve vendorId from the first item
    const firstItem = orderItems[0];
    const vendorId = firstItem.vendorId;

    // Fetch vendor from the database
    const vendors = await prisma.$queryRaw<RawVendor[]>`
      SELECT id, name, phone, "momoChannel" FROM public.vendors WHERE id = ${vendorId}::uuid
    `;
    const vendor = vendors[0];
    if (!vendor) {
      throw new Error(`Vendor not found for ID: ${vendorId}`);
    }

    // Fetch products to retrieve item names for SMS
    const productIds = orderItems.map((item) => item.productId);
    const products = await prisma.$queryRaw<RawProduct[]>`
      SELECT id, name FROM public.products WHERE id = ANY(${productIds}::uuid[])
    `;

    const productMap = new Map<string, string>();
    products.forEach((p) => productMap.set(p.id, p.name));

    // Construct the text listing items
    const orderItemsText = orderItems
      .map((item) => {
        const name = productMap.get(item.productId) || 'Product';
        return `${item.quantity}x ${name}`;
      })
      .join(', ');

    const totalGhs = (order.totalInPesewas / 100).toFixed(2);
    const message = `Maame Order Alert! You have a new order: ${orderItemsText}. Total: GHS ${totalGhs}. Deliver to: ${order.customerPhone}. Order ID: ${order.id.slice(0, 8)}`;

    // Send SMS via Moolre integration
    await this.notificationClient.sendSms(vendor.phone, message);

    // Create VendorFulfillment and update Order status atomically
    const subtotal = orderItems.reduce(
      (acc, item) => acc + item.quantity * item.unitPriceInPesewas,
      0,
    );

    await prisma.$transaction([
      prisma.vendorFulfillment.create({
        data: {
          orderId,
          vendorId,
          subtotalInPesewas: subtotal,
          deliveryStatus: 'pending',
          disbursementStatus: 'not_started',
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'vendor_notified' },
      }),
    ]);
  }

  /**
   * Retrieves the vendor fulfillments associated with a specific order.
   */
  async getFulfillmentsForOrder(orderId: string): Promise<VendorFulfillment[]> {
    return prisma.vendorFulfillment.findMany({
      where: { orderId },
      include: {
        disbursements: true,
      },
    });
  }

  /**
   * Promotes a fulfillment status to delivered:
   * - Transitions fulfillment delivery status to 'delivered' and disbursement to 'processing'.
   * - Creates a pending Disbursement ledger entry.
   * - Transitions the Order to 'delivered'.
   * - Fires asynchronous payout initiation via Moolre client.
   */
  async markFulfillmentDelivered(
    fulfillmentId: string,
    idempotencyKey: string,
    adminId: string,
  ): Promise<VendorFulfillment> {
    const fulfillment = await prisma.vendorFulfillment.findUnique({
      where: { id: fulfillmentId },
      include: { order: true },
    });

    if (!fulfillment) {
      throw new NotFoundError(`Fulfillment not found: ${fulfillmentId}`);
    }

    if (fulfillment.deliveryStatus === 'delivered') {
      throw new FulfillmentAlreadyDeliveredError(`Fulfillment already marked delivered: ${fulfillmentId}`);
    }

    const order = fulfillment.order;
    const allowedStatuses = ['paid', 'vendor_notified', 'out_for_delivery'];
    if (!allowedStatuses.includes(order.status)) {
      throw new InvalidStateTransitionError('order not yet paid');
    }

    // Fetch vendor payout details from raw database
    const vendors = await prisma.$queryRaw<RawVendor[]>`
      SELECT id, phone, "momoChannel" FROM public.vendors WHERE id = ${fulfillment.vendorId}::uuid
    `;
    const vendor = vendors[0];
    if (!vendor) {
      throw new NotFoundError(`Vendor not found for fulfillment: ${fulfillment.vendorId}`);
    }

    // Atomically commit delivery transition and disbursement record
    await prisma.$transaction(async (tx) => {
      await tx.vendorFulfillment.update({
        where: { id: fulfillmentId },
        data: {
          deliveryStatus: 'delivered',
          disbursementStatus: 'processing',
          disbursementReference: idempotencyKey,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'delivered' },
      });

      await tx.disbursement.create({
        data: {
          vendorFulfillmentId: fulfillmentId,
          amountInPesewas: fulfillment.subtotalInPesewas,
          status: 'pending',
          externalref: idempotencyKey,
          adminId,
        },
      });
    });

    // Launch payout transfer asynchronously in background
    this.initiatePayoutTransfer(fulfillmentId, vendor, fulfillment.subtotalInPesewas, idempotencyKey).catch(
      (err) => {
        console.error(
          `Asynchronous payout failed to initiate for fulfillment ${fulfillmentId}:`,
          err,
        );
      },
    );

    const updated = await prisma.vendorFulfillment.findUnique({
      where: { id: fulfillmentId },
    });

    if (!updated) {
      throw new NotFoundError('Fulfillment not found after update');
    }

    return updated;
  }

  /**
   * Fires payout transfer via Moolre Client and logs transaction details.
   */
  private async initiatePayoutTransfer(
    fulfillmentId: string,
    vendor: { phone: string; momoChannel: 'mtn' | 'telecel' | 'at' },
    amountInPesewas: number,
    externalRef: string,
  ): Promise<void> {
    try {
      const { moolreTransactionId } = await this.transferClient.initiateTransfer({
        amountInPesewas,
        vendorPhone: vendor.phone,
        momoChannel: vendor.momoChannel,
        externalRef,
      });

      await prisma.disbursement.update({
        where: { externalref: externalRef },
        data: { moolreTransactionId },
      });
    } catch (err) {
      console.error('Error initiating Moolre payout transfer:', err);

      await prisma.$transaction([
        prisma.disbursement.update({
          where: { externalref: externalRef },
          data: { status: 'failed' },
        }),
        prisma.vendorFulfillment.update({
          where: { id: fulfillmentId },
          data: { disbursementStatus: 'failed' },
        }),
      ]);
    }
  }

  /**
   * Background sweep task polling Moolre for pending disbursements status.
   * Employs exponential backoff with a hard cap at MAX_POLL_COUNT to prevent
   * unbounded retry loops (Phase 8 hardening, G-3).
   */
  private static readonly MAX_POLL_COUNT = 48; // ~24h of exponential backoff before giving up

  async pollPendingDisbursements(): Promise<void> {
    const now = new Date();

    const pendingDisbursements = await prisma.disbursement.findMany({
      where: {
        status: 'pending',
        nextPollAt: { lte: now },
      },
      include: {
        vendorFulfillment: true,
      },
    });

    for (const disbursement of pendingDisbursements) {
      try {
        const result = await this.transferClient.getTransactionStatus(disbursement.externalref);

        if (result.status === 'success') {
          await prisma.$transaction([
            prisma.disbursement.update({
              where: { id: disbursement.id },
              data: {
                status: 'success',
                moolreTransactionId: result.moolreTransactionId || disbursement.moolreTransactionId,
                moolreFeeInPesewas: result.fee ?? null,
              },
            }),
            prisma.vendorFulfillment.update({
              where: { id: disbursement.vendorFulfillmentId },
              data: {
                disbursementStatus: 'completed',
              },
            }),
            prisma.order.update({
              where: { id: disbursement.vendorFulfillment.orderId },
              data: {
                status: 'disbursed',
              },
            }),
          ]);
          console.log(`Disbursement ${disbursement.id} updated to success.`);
        } else if (result.status === 'failed') {
          await prisma.$transaction([
            prisma.disbursement.update({
              where: { id: disbursement.id },
              data: {
                status: 'failed',
              },
            }),
            prisma.vendorFulfillment.update({
              where: { id: disbursement.vendorFulfillmentId },
              data: {
                disbursementStatus: 'failed',
              },
            }),
          ]);
          console.log(`Disbursement ${disbursement.id} updated to failed.`);
        } else {
          // Still pending: increment poll count and calculate backoff
          const pollCount = disbursement.pollCount + 1;

          // B-7: Cap polling to prevent unbounded retry loops
          if (pollCount >= FulfillmentService.MAX_POLL_COUNT) {
            console.error(
              `🚨 ALERT: Disbursement ${disbursement.id} exceeded max poll count (${FulfillmentService.MAX_POLL_COUNT}). ` +
              `Marking as failed — requires manual investigation. externalref: ${disbursement.externalref}`,
            );
            await prisma.$transaction([
              prisma.disbursement.update({
                where: { id: disbursement.id },
                data: {
                  status: 'failed',
                  pollCount,
                },
              }),
              prisma.vendorFulfillment.update({
                where: { id: disbursement.vendorFulfillmentId },
                data: {
                  disbursementStatus: 'failed',
                },
              }),
            ]);
          } else {
            const delaySeconds = Math.min(30 * Math.pow(2, pollCount), 3600);
            const nextPollAt = new Date(Date.now() + delaySeconds * 1000);

            await prisma.disbursement.update({
              where: { id: disbursement.id },
              data: {
                pollCount,
                nextPollAt,
              },
            });
            console.log(
              `Disbursement ${disbursement.id} still pending (poll ${pollCount}/${FulfillmentService.MAX_POLL_COUNT}), next check in ${delaySeconds}s`,
            );
          }
        }
      } catch (err) {
        console.error(`Error polling disbursement ${disbursement.id}:`, err);
        // Reschedule in 60 seconds on connection failure/transient errors
        const nextPollAt = new Date(Date.now() + 60 * 1000);
        await prisma.disbursement.update({
          where: { id: disbursement.id },
          data: { nextPollAt },
        });
      }
    }
  }
}

export const fulfillmentService = new FulfillmentService(moolreClient, moolreClient);
export default fulfillmentService;
