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
            res.status(200).json(order);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.OrdersController = OrdersController;
exports.default = OrdersController;
