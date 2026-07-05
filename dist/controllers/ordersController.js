"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersController = exports.OrdersController = void 0;
const paymentService_js_1 = require("../services/paymentService.js");
const ordersService_js_1 = require("../services/ordersService.js");
const schemas_js_1 = require("../utils/schemas.js");
function sanitizeOrder(order, userRole) {
    const sanitized = {
        ...order,
        payment: order.payment ? {
            id: order.payment.id,
            orderId: order.payment.orderId,
            moolreTransactionId: order.payment.moolreTransactionId,
            amountInPesewas: order.payment.amountInPesewas,
            moolreFeeInPesewas: order.payment.moolreFeeInPesewas,
            status: order.payment.status,
            createdAt: order.payment.createdAt,
        } : null,
    };
    if (userRole === 'admin') {
        sanitized.llmProviderUsed = order.llmProviderUsed;
    }
    else {
        delete sanitized.llmProviderUsed;
    }
    return sanitized;
}
class OrdersController {
    async getOrders(req, res, next) {
        try {
            const filters = schemas_js_1.getOrdersQuerySchema.parse(req.query);
            const result = await ordersService_js_1.ordersService.getOrders(filters);
            const sanitizedData = result.data.map((order) => sanitizeOrder(order, req.user?.role));
            res.status(200).json({
                data: sanitizedData,
                pagination: result.pagination,
            });
        }
        catch (err) {
            next(err);
        }
    }
    async getOrder(req, res, next) {
        try {
            const params = schemas_js_1.getOrderParamsSchema.parse(req.params);
            const order = await ordersService_js_1.ordersService.getOrder(params.orderId);
            const responseData = sanitizeOrder(order, req.user?.role);
            res.status(200).json(responseData);
        }
        catch (err) {
            next(err);
        }
    }
    async cancelOrder(req, res, next) {
        try {
            const params = schemas_js_1.getOrderParamsSchema.parse(req.params);
            const idempotencyKey = req.headers['idempotency-key'];
            const order = await ordersService_js_1.ordersService.cancelOrder(params.orderId, idempotencyKey);
            const responseData = sanitizeOrder(order, req.user?.role);
            res.status(200).json(responseData);
        }
        catch (err) {
            next(err);
        }
    }
    async retryPayment(req, res, next) {
        try {
            const params = schemas_js_1.retryPaymentParamsSchema.parse(req.params);
            const idempotencyKey = req.headers['idempotency-key'];
            const order = await paymentService_js_1.paymentService.retryPayment(params.orderId, idempotencyKey);
            const responseData = sanitizeOrder(order, req.user?.role);
            res.status(200).json(responseData);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.OrdersController = OrdersController;
exports.ordersController = new OrdersController();
exports.default = exports.ordersController;
