"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersService = exports.OrdersService = void 0;
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../errors/index.js");
class OrdersService {
    async getOrders(filters) {
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.channel) {
            where.channel = filters.channel;
        }
        if (filters.since) {
            where.updatedAt = { gt: new Date(filters.since) };
        }
        let prismaCursor = undefined;
        if (filters.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
                if (decoded && decoded.id) {
                    prismaCursor = { id: decoded.id };
                }
            }
            catch (err) {
                // Fallback for invalid cursors
            }
        }
        const limit = filters.limit;
        const items = await prisma_js_1.prisma.order.findMany({
            where,
            take: limit + 1,
            skip: prismaCursor ? 1 : 0,
            cursor: prismaCursor,
            orderBy: { createdAt: 'desc' },
        });
        const hasMore = items.length > limit;
        const data = hasMore ? items.slice(0, limit) : items;
        let nextCursor = null;
        if (hasMore && data.length > 0) {
            const lastItem = data[data.length - 1];
            nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
        }
        return {
            data,
            pagination: {
                nextCursor,
                hasMore,
                limit,
            },
        };
    }
    async getOrder(orderId) {
        const order = await prisma_js_1.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: true,
                fulfillments: {
                    include: {
                        disbursements: true,
                    },
                },
                payment: true,
            },
        });
        if (!order) {
            throw new index_js_1.NotFoundError(`Order not found: ${orderId}`);
        }
        return order;
    }
    async cancelOrder(orderId, idempotencyKey) {
        const order = await prisma_js_1.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            throw new index_js_1.NotFoundError(`Order not found: ${orderId}`);
        }
        // Contract §5.4: invalid-state-transition — cannot cancel an already-disbursed order.
        // Also guard against double-cancel returning a silent 200 with no state change.
        if (order.status === 'disbursed') {
            throw new index_js_1.InvalidStateTransitionError('Cannot cancel an already-disbursed order');
        }
        if (order.status === 'cancelled') {
            throw new index_js_1.InvalidStateTransitionError('Order is already cancelled');
        }
        const updated = await prisma_js_1.prisma.order.update({
            where: { id: orderId },
            data: { status: 'cancelled' },
            include: {
                orderItems: true,
                fulfillments: {
                    include: {
                        disbursements: true,
                    },
                },
                payment: true,
            },
        });
        return updated;
    }
}
exports.OrdersService = OrdersService;
exports.ordersService = new OrdersService();
exports.default = exports.ordersService;
