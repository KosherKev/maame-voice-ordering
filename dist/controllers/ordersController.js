"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const paymentService_js_1 = require("../services/paymentService.js");
const schemas_js_1 = require("../utils/schemas.js");
class OrdersController {
    async retryPayment(req, res, next) {
        try {
            // Validate path parameter
            const params = schemas_js_1.retryPaymentParamsSchema.parse(req.params);
            // Get Idempotency-Key from headers
            const idempotencyKey = req.headers['idempotency-key'];
            const order = await paymentService_js_1.paymentService.retryPayment(params.orderId, idempotencyKey);
            // Exclude internal-only fields from response
            const responseData = {
                ...order,
                llmProviderUsed: req.user?.role === 'admin' ? order.llmProviderUsed : undefined,
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
            if (responseData.llmProviderUsed === undefined) {
                delete responseData.llmProviderUsed;
            }
            res.status(200).json(responseData);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.OrdersController = OrdersController;
exports.default = OrdersController;
