"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ussdService = exports.UssdService = void 0;
const prisma_js_1 = require("../db/prisma.js");
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../integrations/index.js");
const index_js_2 = require("../errors/index.js");
const paymentService_js_1 = require("./paymentService.js");
// ---------------------------------------------------------------------------
// USSD Menu state constants
// The menuState field in USSDSession tracks where the customer is in the flow.
// ---------------------------------------------------------------------------
const MENU_WELCOME = 'welcome';
const MENU_COLLECTING = 'collecting';
const MENU_CONFIRMING = 'confirming';
const MENU_AWAITING_PAYMENT = 'awaiting_payment';
const MENU_DONE = 'done';
// Internal markers stripped at the controller boundary before the JSON response
// is sent to Moolre as { message, reply } (confirmed format — G-7 resolved).
const USSD_CONTINUE = 'CON'; // reply: true
const USSD_END = 'END'; // reply: false
class UssdService {
    /**
     * Main entry point: processes one USSD turn from Moolre's inbound webhook.
     * Reuses the Order/OrderItem engine and LlmClient built in Phase 3.
     */
    async handleInboundSession(payload) {
        const { sessionId, msisdn, message } = payload;
        // Find or create the USSDSession row.
        // Moolre's confirmed payload has no explicit "session terminated by network" signal —
        // abandoned sessions are handled by the background sweep job (Phase 4).
        let ussdSession = await prisma_js_1.prisma.uSSDSession.findFirst({
            where: { sessionIdMoolre: sessionId },
        });
        if (!ussdSession) {
            ussdSession = await prisma_js_1.prisma.uSSDSession.create({
                data: {
                    customerPhone: msisdn,
                    sessionIdMoolre: sessionId,
                    status: 'active',
                    menuState: MENU_WELCOME,
                },
            });
        }
        // Route to the correct handler based on current menu state
        switch (ussdSession.menuState) {
            case MENU_WELCOME:
                return this.handleWelcome(ussdSession, message);
            case MENU_COLLECTING:
                return this.handleCollecting(ussdSession, msisdn, message);
            case MENU_CONFIRMING:
                return this.handleConfirming(ussdSession, message);
            case MENU_AWAITING_PAYMENT:
            case MENU_DONE:
                return {
                    responseText: `${USSD_END}\nYour order is being processed. You will receive a Mobile Money prompt shortly.`,
                    isEnd: true,
                };
            default:
                return this.handleWelcome(ussdSession, message);
        }
    }
    // ---------------------------------------------------------------------------
    // State handlers
    // ---------------------------------------------------------------------------
    /** First turn: display welcome and catalog hint. */
    async handleWelcome(ussdSession, _text) {
        await prisma_js_1.prisma.uSSDSession.update({
            where: { id: ussdSession.id },
            data: { menuState: MENU_COLLECTING },
        });
        const welcome = `${USSD_CONTINUE}\nEte sen! Welcome to Maame.\n` +
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
    async handleCollecting(ussdSession, customerPhone, text) {
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
            ? await prisma_js_1.prisma.order.findUnique({
                where: { id: ussdSession.orderId },
                include: { orderItems: true },
            })
            : null;
        const basket = currentOrder
            ? currentOrder.orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPriceInPesewas: item.unitPriceInPesewas,
                vendorId: item.vendorId,
            }))
            : [];
        // Build a minimal "transcript" structure expected by llmClient.processSpeech
        const history = [
            { speaker: 'customer', text: input, timestamp: new Date() },
        ];
        // Delegate to shared LLM client (same interface as voice channel)
        const decision = await index_js_1.llmClient.processSpeech(catalog, basket, history, input);
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
                let lockedVendorId = null;
                if (currentOrder && currentOrder.orderItems.length > 0) {
                    lockedVendorId = currentOrder.orderItems[0].vendorId;
                }
                // Single-vendor constraint check
                for (const item of matchedItems) {
                    const product = catalog.find((p) => p.id === item.productId);
                    if (!product)
                        continue;
                    if (lockedVendorId && product.vendorId !== lockedVendorId) {
                        const vendorName = catalog.find((p) => p.vendorId === lockedVendorId)?.vendorName ||
                            'the selected joint';
                        return {
                            responseText: `${USSD_CONTINUE}\nYou can only order from one joint per session.\n` +
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
                let order = currentOrder;
                if (!order) {
                    order = await prisma_js_1.prisma.order.create({
                        data: {
                            customerPhone,
                            channel: 'ussd',
                            status: 'collecting_items',
                            totalInPesewas: 0,
                            serviceFeeInPesewas: 800, // GHS 8.00 standard service fee
                            ussdSessionId: ussdSession.id,
                            llmProviderUsed: env_js_1.env.LLM_PROVIDER,
                        },
                    });
                    // Link USSDSession → Order
                    await prisma_js_1.prisma.uSSDSession.update({
                        where: { id: ussdSession.id },
                        data: { orderId: order.id },
                    });
                }
                // Apply item mutations
                for (const item of matchedItems) {
                    const product = catalog.find((p) => p.id === item.productId);
                    if (!product)
                        continue;
                    const existingItem = await prisma_js_1.prisma.orderItem.findFirst({
                        where: { orderId: order.id, productId: item.productId },
                    });
                    if (decision.intent === 'add_item') {
                        if (existingItem) {
                            await prisma_js_1.prisma.orderItem.update({
                                where: { id: existingItem.id },
                                data: { quantity: existingItem.quantity + item.quantity },
                            });
                        }
                        else {
                            await prisma_js_1.prisma.orderItem.create({
                                data: {
                                    orderId: order.id,
                                    productId: item.productId,
                                    vendorId: product.vendorId,
                                    quantity: item.quantity,
                                    unitPriceInPesewas: product.priceInPesewas,
                                },
                            });
                        }
                    }
                    else if (decision.intent === 'remove_item' && existingItem) {
                        const newQty = existingItem.quantity - item.quantity;
                        if (newQty <= 0) {
                            await prisma_js_1.prisma.orderItem.delete({ where: { id: existingItem.id } });
                        }
                        else {
                            await prisma_js_1.prisma.orderItem.update({
                                where: { id: existingItem.id },
                                data: { quantity: newQty },
                            });
                        }
                    }
                }
                // Recalculate order total
                const allItems = await prisma_js_1.prisma.orderItem.findMany({ where: { orderId: order.id } });
                const itemsSubtotal = allItems.reduce((sum, i) => sum + i.quantity * i.unitPriceInPesewas, 0);
                const newTotal = itemsSubtotal + order.serviceFeeInPesewas;
                await prisma_js_1.prisma.order.update({
                    where: { id: order.id },
                    data: { totalInPesewas: newTotal },
                });
                const vendorName = catalog.find((p) => p.vendorId === lockedVendorId)?.vendorName || 'selected joint';
                const summaryText = decision.orderSummaryText ||
                    `Added to basket. Subtotal: GHS ${(itemsSubtotal / 100).toFixed(2)} from ${vendorName}.`;
                return {
                    responseText: `${USSD_CONTINUE}\n${summaryText}\n\nType more items, DONE to confirm, or CANCEL to stop.`,
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
    async handleDone(ussdSession) {
        if (!ussdSession.orderId) {
            return {
                responseText: `${USSD_CONTINUE}\nYour basket is empty. Please type what you would like to order first.`,
                isEnd: false,
            };
        }
        const order = await prisma_js_1.prisma.order.findUnique({
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
        await prisma_js_1.prisma.$transaction([
            prisma_js_1.prisma.order.update({
                where: { id: order.id },
                data: { status: 'confirming_order' },
            }),
            prisma_js_1.prisma.uSSDSession.update({
                where: { id: ussdSession.id },
                data: { menuState: MENU_CONFIRMING },
            }),
        ]);
        const totalGhs = (order.totalInPesewas / 100).toFixed(2);
        const itemLines = order.orderItems
            .map((i) => `  - x${i.quantity} item @ GHS ${(i.unitPriceInPesewas / 100).toFixed(2)}`)
            .join('\n');
        return {
            responseText: `${USSD_CONTINUE}\nOrder summary:\n${itemLines}\n` +
                `Total: GHS ${totalGhs} (incl. service fee)\n\n` +
                `1. Confirm and Pay\n2. Cancel`,
            isEnd: false,
        };
    }
    /**
     * Final confirmation turn: customer replies 1 (confirm) or 2 (cancel).
     * Fires payment initiation fire-and-forget on confirm.
     */
    async handleConfirming(ussdSession, text) {
        const input = text.trim();
        if (input === '1') {
            if (!ussdSession.orderId) {
                return {
                    responseText: `${USSD_END}\nSomething went wrong. Please try again by dialling *203#.`,
                    isEnd: true,
                };
            }
            // Mark session done and close
            await prisma_js_1.prisma.uSSDSession.update({
                where: { id: ussdSession.id },
                data: {
                    menuState: MENU_AWAITING_PAYMENT,
                    status: 'completed',
                    endedAt: new Date(),
                },
            });
            // Fire-and-forget payment initiation (same flow as voice channel)
            paymentService_js_1.paymentService.initiateVoiceOrderPayment(ussdSession.orderId).catch((err) => {
                console.error('❌ Failed to initiate USSD order payment:', err);
            });
            return {
                responseText: `${USSD_END}\nThank you! A Mobile Money payment prompt has been sent to your phone.\n` +
                    `Please approve it to complete your order.`,
                isEnd: true,
            };
        }
        if (input === '2' || input.toUpperCase() === 'CANCEL') {
            return this.handleCancel(ussdSession);
        }
        // Invalid input in confirming state
        return {
            responseText: `${USSD_CONTINUE}\nPlease reply:\n1. Confirm and Pay\n2. Cancel`,
            isEnd: false,
        };
    }
    /** Cancels the current order (if any) and terminates the session. */
    async handleCancel(ussdSession) {
        const updates = [
            prisma_js_1.prisma.uSSDSession.update({
                where: { id: ussdSession.id },
                data: { status: 'completed', menuState: MENU_DONE, endedAt: new Date() },
            }),
        ];
        if (ussdSession.orderId) {
            updates.push(prisma_js_1.prisma.order.update({
                where: { id: ussdSession.orderId },
                data: { status: 'cancelled' },
            }));
        }
        await Promise.all(updates);
        return {
            responseText: `${USSD_END}\nYour order has been cancelled. Thank you for using Maame!`,
            isEnd: true,
        };
    }
    /**
     * Marks a session and its linked order as abandoned.
     * Called by the background sweep job (Phase 4) for sessions idle past the timeout.
     * Not triggered by an inbound webhook signal — Moolre's confirmed payload has no
     * explicit network-termination field.
     */
    async handleSessionEnd(moolreSessionId) {
        const session = await prisma_js_1.prisma.uSSDSession.findFirst({
            where: { sessionIdMoolre: moolreSessionId },
        });
        if (!session || session.status !== 'active')
            return;
        await prisma_js_1.prisma.uSSDSession.update({
            where: { id: session.id },
            data: { status: 'abandoned', endedAt: new Date() },
        });
        if (session.orderId) {
            const order = await prisma_js_1.prisma.order.findUnique({ where: { id: session.orderId } });
            if (order && (order.status === 'collecting_items' || order.status === 'confirming_order')) {
                await prisma_js_1.prisma.order.update({
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
    async fetchActiveCatalog() {
        return prisma_js_1.prisma.$queryRaw `
      SELECT p.id, p.name, p."priceInPesewas", p."vendorId", v.name as "vendorName"
      FROM public.products p
      JOIN public.vendors v ON p."vendorId" = v.id
      WHERE p."inStock" = true AND v.active = true
    `;
    }
    // ---------------------------------------------------------------------------
    // List / read endpoints (§5.7)
    // ---------------------------------------------------------------------------
    async getUssdSessions(filters) {
        const where = {};
        if (filters.phone)
            where.customerPhone = filters.phone;
        if (filters.since)
            where.createdAt = { gt: new Date(filters.since) };
        let prismaCursor;
        if (filters.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
                if (decoded?.id)
                    prismaCursor = { id: decoded.id };
            }
            catch {
                // Invalid cursor — ignore and start from the beginning
            }
        }
        const items = await prisma_js_1.prisma.uSSDSession.findMany({
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
        let nextCursor = null;
        if (hasMore && data.length > 0) {
            const lastItem = data[data.length - 1];
            nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
        }
        return { data, pagination: { nextCursor, hasMore, limit: filters.limit } };
    }
    async getUssdSession(id) {
        const session = await prisma_js_1.prisma.uSSDSession.findUnique({ where: { id } });
        if (!session)
            throw new index_js_2.NotFoundError(`USSD session not found: ${id}`);
        // Exclude sessionIdMoolre (internal-only per contract §9)
        const { sessionIdMoolre: _internal, ...publicFields } = session;
        return publicFields;
    }
}
exports.UssdService = UssdService;
exports.ussdService = new UssdService();
exports.default = exports.ussdService;
