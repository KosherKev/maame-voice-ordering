import { prisma } from '../db/prisma.js';
import { moolreClient } from '../integrations/index.js';
import { NotFoundError, InvalidStateTransitionError } from '../errors/index.js';
import { randomUUID } from 'crypto';
import { Order, OrderItem, Payment } from '@prisma/client';

export class PaymentService {
  /**
   * Initiates payment for a voice order confirmed during a call.
   * Generates a unique external reference.
   */
  async initiateVoiceOrderPayment(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    const externalRef = randomUUID();

    // Create Payment record and transition Order to awaiting_payment atomically
    await prisma.$transaction(async (tx) => {
      // Create payment
      await tx.payment.create({
        data: {
          orderId: order.id,
          amountInPesewas: order.totalInPesewas,
          status: 'pending',
          externalref: externalRef,
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'awaiting_payment' },
      });
    });

    // Call Moolre client to trigger MoMo push prompt
    const { moolreTransactionId } = await moolreClient.initiatePayment({
      amountInPesewas: order.totalInPesewas,
      customerPhone: order.customerPhone,
      externalRef,
    });

    // Update payment with Moolre transaction ID
    await prisma.payment.update({
      where: { externalref: externalRef },
      data: { moolreTransactionId },
    });
  }

  /**
   * Retries payment for an order in payment_failed status.
   * Uses the request's idempotency key as the external reference.
   */
  async retryPayment(
    orderId: string,
    idempotencyKey: string,
  ): Promise<Order & { orderItems: OrderItem[]; payment: Payment | null }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    if (order.status !== 'payment_failed') {
      throw new InvalidStateTransitionError(`Cannot retry payment for order in state: ${order.status}`);
    }

    // Transition Order to awaiting_payment and upsert Payment record atomically
    await prisma.$transaction(async (tx) => {
      // Upsert payment (re-initialize/link the single payment object)
      await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          amountInPesewas: order.totalInPesewas,
          status: 'pending',
          externalref: idempotencyKey,
        },
        update: {
          amountInPesewas: order.totalInPesewas,
          status: 'pending',
          externalref: idempotencyKey,
          moolreTransactionId: null, // clear previous one until new initiation succeeds
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'awaiting_payment' },
      });
    });

    // Call Moolre client to trigger MoMo push prompt
    const { moolreTransactionId } = await moolreClient.initiatePayment({
      amountInPesewas: order.totalInPesewas,
      customerPhone: order.customerPhone,
      externalRef: idempotencyKey,
    });

    // Update payment with Moolre transaction ID
    await prisma.payment.update({
      where: { externalref: idempotencyKey },
      data: { moolreTransactionId },
    });

    // Fetch and return the updated order structure matching GET /v1/orders/{orderId}
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        payment: true,
      },
    });

    if (!updatedOrder) {
      throw new NotFoundError(`Order not found after retry: ${orderId}`);
    }

    return updatedOrder;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
