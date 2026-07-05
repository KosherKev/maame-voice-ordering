import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { llmClient } from '../integrations/index.js';
import { NotFoundError } from '../errors/index.js';
import { paymentService } from './paymentService.js';
import { MoolreUssdInboundPayload } from '../utils/schemas.js';

// ---------------------------------------------------------------------------
// USSD Menu state constants
// The menuState field in USSDSession tracks where the customer is in the flow.
// ---------------------------------------------------------------------------
const MENU_WELCOME = 'welcome';
const MENU_COLLECTING = 'collecting';
const MENU_CONFIRMING = 'confirming';
const MENU_AWAITING_PAYMENT = 'awaiting_payment';
const MENU_DONE = 'done';

// Moolre USSD response type codes
const USSD_CONTINUE = 'CON'; // Continue session (prompt customer for input)
const USSD_END = 'END'; // Terminate session (final message, no input expected)

/**
 * G-7 FLAG: The exact Moolre USSD response format (CON/END prefix, or a JSON wrapper)
 * must be confirmed against the live Moolre sandbox before production use.
 * This implementation uses the documented *203# convention where the response body
 * is plain text prefixed with CON (continue) or END (terminate).
 * Update formatResponse() if Moolre's actual format differs.
 */

export interface UssdTurnResult {
  /** Plain-text USSD response body for Moolre */
  responseText: string;
  /** Whether this turn ends the USSD session */
  isEnd: boolean;
}

export class UssdService {
  /**
   * Main entry point: processes one USSD turn from Moolre's inbound webhook.
   * Reuses the Order/OrderItem engine and LlmClient built in Phase 3.
   */
  async handleInboundSession(payload: MoolreUssdInboundPayload): Promise<UssdTurnResult> {
    const { sessionid, msisdn, text, type } = payload;

    // type=2 means the network terminated the session before the customer did
    if (type === 2) {
      await this.handleSessionEnd(sessionid);
      return { responseText: `${USSD_END}\nThank you for using Maame!`, isEnd: true };
    }

    // Find or create the USSDSession row
    let ussdSession = await prisma.uSSDSession.findFirst({
      where: { sessionIdMoolre: sessionid },
    });

    if (!ussdSession) {
      ussdSession = await prisma.uSSDSession.create({
        data: {
          customerPhone: msisdn,
          sessionIdMoolre: sessionid,
          status: 'active',
          menuState: MENU_WELCOME,
        },
      });
    }

    // Route to the correct handler based on current menu state
    switch (ussdSession.menuState) {
      case MENU_WELCOME:
        return this.handleWelcome(ussdSession, text);

      case MENU_COLLECTING:
        return this.handleCollecting(ussdSession, msisdn, text);

      case MENU_CONFIRMING:
        return this.handleConfirming(ussdSession, text);

      case MENU_AWAITING_PAYMENT:
      case MENU_DONE:
        return {
          responseText: `${USSD_END}\nYour order is being processed. You will receive a Mobile Money prompt shortly.`,
          isEnd: true,
        };

      default:
        return this.handleWelcome(ussdSession, text);
    }
  }

  // ---------------------------------------------------------------------------
  // State handlers
  // ---------------------------------------------------------------------------

  /** First turn: display welcome and catalog hint. */
  private async handleWelcome(ussdSession: any, _text: string): Promise<UssdTurnResult> {
    await prisma.uSSDSession.update({
      where: { id: ussdSession.id },
      data: { menuState: MENU_COLLECTING },
    });

    const welcome =
      `${USSD_CONTINUE}\nEte sen! Welcome to Maame.\n` +
      `Type the name and quantity of what you want to order.\n` +
      `Example: "2 jollof rice" or "fufu and soup"\n` +
      `Type DONE to confirm, or CANCEL to stop.`;

    return { responseText: welcome, isEnd: false };
  }

  /**
   * Collecting items: customer types a food request.
   * Passes input to the shared LlmClient to match catalog items.
   * Reuses fetchActiveCatalog and Order/OrderItem write patterns from Phase 3.
   */
  private async handleCollecting(
    ussdSession: any,
    customerPhone: string,
    text: string,
  ): Promise<UssdTurnResult> {
    const input = text.trim();

    if (!input) {
      return {
        responseText: `${USSD_CONTINUE}\nPlease type what you would like to order.\nExample: 2 jollof rice\nType DONE to confirm or CANCEL to stop.`,
        isEnd: false,
      };
    }

    // Handle explicit exit commands
    if (input.toUpperCase() === 'CANCEL') {
      return this.handleCancel(ussdSession);
    }

    if (input.toUpperCase() === 'DONE') {
      return this.handleDone(ussdSession);
    }

    // Fetch catalog and current basket
    const catalog = await this.fetchActiveCatalog();

    const currentOrder = ussdSession.orderId
      ? await prisma.order.findUnique({
          where: { id: ussdSession.orderId },
          include: { orderItems: true },
        })
      : null;

    const basket = currentOrder
      ? currentOrder.orderItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceInPesewas: item.unitPriceInPesewas,
          vendorId: item.vendorId,
        }))
      : [];

    // Build a minimal "transcript" structure expected by llmClient.processSpeech
    const history: { speaker: 'customer' | 'maame'; text: string; timestamp: Date }[] = [
      { speaker: 'customer', text: input, timestamp: new Date() },
    ];

    // Delegate to shared LLM client (same interface as voice channel)
    const decision = await llmClient.processSpeech(catalog, basket, history, input);

    switch (decision.intent) {
      case 'cancel':
        return this.handleCancel(ussdSession);

      case 'confirm_order':
        return this.handleDone(ussdSession);

      case 'ask_clarification': {
        const question = decision.clarifyingQuestion || 'Could not find that item. Please try again.';
        return {
          responseText: `${USSD_CONTINUE}\n${question}\nType DONE to confirm or CANCEL to stop.`,
          isEnd: false,
        };
      }

      case 'add_item':
      case 'remove_item': {
        const matchedItems = decision.matchedItems || [];

        if (matchedItems.length === 0) {
          const fallback = decision.clarifyingQuestion || 'Item not found in our catalog. Please try again.';
          return {
            responseText: `${USSD_CONTINUE}\n${fallback}\nType DONE to confirm or CANCEL to stop.`,
            isEnd: false,
          };
        }

        // Determine vendor lock
        let lockedVendorId: string | null = null;
        if (currentOrder && currentOrder.orderItems.length > 0) {
          lockedVendorId = (currentOrder.orderItems[0] as any).vendorId;
        }

        // Single-vendor constraint check
        for (const item of matchedItems) {
          const product = catalog.find((p: any) => p.id === item.productId);
          if (!product) continue;
          if (lockedVendorId && product.vendorId !== lockedVendorId) {
            const vendorName =
              catalog.find((p: any) => p.vendorId === lockedVendorId)?.vendorName ||
              'the selected joint';
            return {
              responseText:
                `${USSD_CONTINUE}\nYou can only order from one joint per session.\n` +
                `Your basket is locked to ${vendorName}.\n` +
                `Type DONE to confirm or CANCEL to start over.`,
              isEnd: false,
            };
          }
          if (!lockedVendorId) {
            lockedVendorId = product.vendorId;
          }
        }

        // Create order if needed (ussd channel)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let order: any = currentOrder;
        if (!order) {
          order = await prisma.order.create({
            data: {
              customerPhone,
              channel: 'ussd',
              status: 'collecting_items',
              totalInPesewas: 0,
              serviceFeeInPesewas: 800, // GHS 8.00 standard service fee
              ussdSessionId: ussdSession.id,
              llmProviderUsed: env.LLM_PROVIDER,
            },
          });

          // Link USSDSession → Order
          await prisma.uSSDSession.update({
            where: { id: ussdSession.id },
            data: { orderId: order.id },
          });
        }

        // Apply item mutations
        for (const item of matchedItems) {
          const product = catalog.find((p: any) => p.id === item.productId);
          if (!product) continue;

          const existingItem = await prisma.orderItem.findFirst({
            where: { orderId: order.id, productId: item.productId },
          });

          if (decision.intent === 'add_item') {
            if (existingItem) {
              await prisma.orderItem.update({
                where: { id: existingItem.id },
                data: { quantity: existingItem.quantity + item.quantity },
              });
            } else {
              await prisma.orderItem.create({
                data: {
                  orderId: order.id,
                  productId: item.productId,
                  vendorId: product.vendorId,
                  quantity: item.quantity,
                  unitPriceInPesewas: product.priceInPesewas,
                },
              });
            }
          } else if (decision.intent === 'remove_item' && existingItem) {
            const newQty = existingItem.quantity - item.quantity;
            if (newQty <= 0) {
              await prisma.orderItem.delete({ where: { id: existingItem.id } });
            } else {
              await prisma.orderItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQty },
              });
            }
          }
        }

        // Recalculate order total
        const allItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });
        const itemsSubtotal = allItems.reduce(
          (sum, i) => sum + i.quantity * i.unitPriceInPesewas,
          0,
        );
        const newTotal = itemsSubtotal + order.serviceFeeInPesewas;

        await prisma.order.update({
          where: { id: order.id },
          data: { totalInPesewas: newTotal },
        });

        const vendorName =
          catalog.find((p: any) => p.vendorId === lockedVendorId)?.vendorName || 'selected joint';
        const summaryText =
          decision.orderSummaryText ||
          `Added to basket. Subtotal: GHS ${(itemsSubtotal / 100).toFixed(2)} from ${vendorName}.`;

        return {
          responseText:
            `${USSD_CONTINUE}\n${summaryText}\n\nType more items, DONE to confirm, or CANCEL to stop.`,
          isEnd: false,
        };
      }

      default:
        return {
          responseText: `${USSD_CONTINUE}\nSorry, I did not understand that. Please try again.\nType DONE to confirm or CANCEL to stop.`,
          isEnd: false,
        };
    }
  }

  /**
   * Customer typed DONE: show order summary and ask for final confirmation.
   * Transitions order → confirming_order and session → confirming state.
   */
  private async handleDone(ussdSession: any): Promise<UssdTurnResult> {
    if (!ussdSession.orderId) {
      return {
        responseText: `${USSD_CONTINUE}\nYour basket is empty. Please type what you would like to order first.`,
        isEnd: false,
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: ussdSession.orderId },
      include: { orderItems: true },
    });

    if (!order || order.orderItems.length === 0) {
      return {
        responseText: `${USSD_CONTINUE}\nYour basket is empty. Please type what you would like to order first.`,
        isEnd: false,
      };
    }

    // Transition order and session state
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'confirming_order' },
      }),
      prisma.uSSDSession.update({
        where: { id: ussdSession.id },
        data: { menuState: MENU_CONFIRMING },
      }),
    ]);

    const totalGhs = (order.totalInPesewas / 100).toFixed(2);
    const itemLines = order.orderItems
      .map((i: any) => `  - x${i.quantity} item @ GHS ${(i.unitPriceInPesewas / 100).toFixed(2)}`)
      .join('\n');

    return {
      responseText:
        `${USSD_CONTINUE}\nOrder summary:\n${itemLines}\n` +
        `Total: GHS ${totalGhs} (incl. service fee)\n\n` +
        `1. Confirm and Pay\n2. Cancel`,
      isEnd: false,
    };
  }

  /**
   * Final confirmation turn: customer replies 1 (confirm) or 2 (cancel).
   * Fires payment initiation fire-and-forget on confirm.
   */
  private async handleConfirming(ussdSession: any, text: string): Promise<UssdTurnResult> {
    const input = text.trim();

    if (input === '1') {
      if (!ussdSession.orderId) {
        return {
          responseText: `${USSD_END}\nSomething went wrong. Please try again by dialling *203#.`,
          isEnd: true,
        };
      }

      // Mark session done and close
      await prisma.uSSDSession.update({
        where: { id: ussdSession.id },
        data: {
          menuState: MENU_AWAITING_PAYMENT,
          status: 'completed',
          endedAt: new Date(),
        },
      });

      // Fire-and-forget payment initiation (same flow as voice channel)
      paymentService.initiateVoiceOrderPayment(ussdSession.orderId).catch((err) => {
        console.error('❌ Failed to initiate USSD order payment:', err);
      });

      return {
        responseText:
          `${USSD_END}\nThank you! A Mobile Money payment prompt has been sent to your phone.\n` +
          `Please approve it to complete your order.`,
        isEnd: true,
      };
    }

    if (input === '2' || input.toUpperCase() === 'CANCEL') {
      return this.handleCancel(ussdSession);
    }

    // Invalid input in confirming state
    return {
      responseText:
        `${USSD_CONTINUE}\nPlease reply:\n1. Confirm and Pay\n2. Cancel`,
      isEnd: false,
    };
  }

  /** Cancels the current order (if any) and terminates the session. */
  private async handleCancel(ussdSession: any): Promise<UssdTurnResult> {
    const updates: Promise<any>[] = [
      prisma.uSSDSession.update({
        where: { id: ussdSession.id },
        data: { status: 'completed', menuState: MENU_DONE, endedAt: new Date() },
      }),
    ];

    if (ussdSession.orderId) {
      updates.push(
        prisma.order.update({
          where: { id: ussdSession.orderId },
          data: { status: 'cancelled' },
        }),
      );
    }

    await Promise.all(updates);

    return {
      responseText: `${USSD_END}\nYour order has been cancelled. Thank you for using Maame!`,
      isEnd: true,
    };
  }

  /**
   * Handles network-terminated sessions (type=2).
   * Marks session and linked order as abandoned if still in draft state.
   */
  private async handleSessionEnd(moolreSessionId: string): Promise<void> {
    const session = await prisma.uSSDSession.findFirst({
      where: { sessionIdMoolre: moolreSessionId },
    });

    if (!session || session.status !== 'active') return;

    await prisma.uSSDSession.update({
      where: { id: session.id },
      data: { status: 'abandoned', endedAt: new Date() },
    });

    if (session.orderId) {
      const order = await prisma.order.findUnique({ where: { id: session.orderId } });
      if (order && (order.status === 'collecting_items' || order.status === 'confirming_order')) {
        await prisma.order.update({
          where: { id: session.orderId },
          data: { status: 'abandoned' },
        });
      }
    }
  }

  /**
   * Read-only catalog fetch (same raw query as voiceService.fetchActiveCatalog).
   * Shared logic — not duplicated; both services read the same Supabase-owned tables via Prisma.
   */
  private async fetchActiveCatalog(): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p."priceInPesewas", p."vendorId", v.name as "vendorName"
      FROM public.products p
      JOIN public.vendors v ON p."vendorId" = v.id
      WHERE p."inStock" = true AND v.active = true
    `;
  }

  // ---------------------------------------------------------------------------
  // List / read endpoints (§5.7)
  // ---------------------------------------------------------------------------

  async getUssdSessions(filters: {
    limit: number;
    cursor?: string;
    phone?: string;
    since?: string;
  }): Promise<{
    data: any[];
    pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
  }> {
    const where: any = {};
    if (filters.phone) where.customerPhone = filters.phone;
    if (filters.since) where.createdAt = { gt: new Date(filters.since) };

    let prismaCursor: { id: string } | undefined;
    if (filters.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
        if (decoded?.id) prismaCursor = { id: decoded.id };
      } catch {
        // Invalid cursor — ignore and start from the beginning
      }
    }

    const items = await prisma.uSSDSession.findMany({
      where,
      take: filters.limit + 1,
      skip: prismaCursor ? 1 : 0,
      cursor: prismaCursor,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        customerPhone: true,
        status: true,
        orderId: true,
        menuState: true,
        createdAt: true,
        endedAt: true,
        // sessionIdMoolre is internal-only — intentionally excluded from the response
      },
    });

    const hasMore = items.length > filters.limit;
    const data = hasMore ? items.slice(0, filters.limit) : items;
    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
    }

    return { data, pagination: { nextCursor, hasMore, limit: filters.limit } };
  }

  async getUssdSession(id: string): Promise<any> {
    const session = await prisma.uSSDSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundError(`USSD session not found: ${id}`);

    // Exclude sessionIdMoolre (internal-only per contract §9)
    const { sessionIdMoolre: _internal, ...publicFields } = session as any;
    return publicFields;
  }
}

export const ussdService = new UssdService();
export default ussdService;
