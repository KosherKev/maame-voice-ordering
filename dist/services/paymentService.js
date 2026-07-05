"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../integrations/index.js");
const index_js_2 = require("../errors/index.js");
const crypto_1 = require("crypto");
class PaymentService {
    /**
     * Initiates payment for a voice order confirmed during a call.
     * Generates a unique external reference.
     */
    async initiateVoiceOrderPayment(orderId) {
        const order = await prisma_js_1.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            throw new index_js_2.NotFoundError(`Order not found: ${orderId}`);
        }
        const externalRef = (0, crypto_1.randomUUID)();
        // Create Payment record and transition Order to awaiting_payment atomically
        await prisma_js_1.prisma.$transaction(async (tx) => {
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
        const { moolreTransactionId } = await index_js_1.moolreClient.initiatePayment({
            amountInPesewas: order.totalInPesewas,
            customerPhone: order.customerPhone,
            externalRef,
        });
        // Update payment with Moolre transaction ID
        await prisma_js_1.prisma.payment.update({
            where: { externalref: externalRef },
            data: { moolreTransactionId },
        });
    }
    /**
     * Retries payment for an order in payment_failed status.
     * Uses the request's idempotency key as the external reference.
     */
    async retryPayment(orderId, idempotencyKey) {
        const order = await prisma_js_1.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: true,
                payment: true,
            },
        });
        if (!order) {
            throw new index_js_2.NotFoundError(`Order not found: ${orderId}`);
        }
        if (order.status !== 'payment_failed') {
            throw new index_js_2.InvalidStateTransitionError(`Cannot retry payment for order in state: ${order.status}`);
        }
        // Transition Order to awaiting_payment and upsert Payment record atomically
        await prisma_js_1.prisma.$transaction(async (tx) => {
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
        const { moolreTransactionId } = await index_js_1.moolreClient.initiatePayment({
            amountInPesewas: order.totalInPesewas,
            customerPhone: order.customerPhone,
            externalRef: idempotencyKey,
        });
        // Update payment with Moolre transaction ID
        await prisma_js_1.prisma.payment.update({
            where: { externalref: idempotencyKey },
            data: { moolreTransactionId },
        });
        // Fetch and return the updated order structure matching GET /v1/orders/{orderId}
        const updatedOrder = await prisma_js_1.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: true,
                payment: true,
            },
        });
        if (!updatedOrder) {
            throw new index_js_2.NotFoundError(`Order not found after retry: ${orderId}`);
        }
        return updatedOrder;
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
exports.default = exports.paymentService;
