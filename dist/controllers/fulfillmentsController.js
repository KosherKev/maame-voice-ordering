"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillmentsController = exports.FulfillmentsController = void 0;
const fulfillmentService_js_1 = require("../services/fulfillmentService.js");
const schemas_js_1 = require("../utils/schemas.js");
class FulfillmentsController {
    async markDelivered(req, res, next) {
        try {
            const params = schemas_js_1.markDeliveredParamsSchema.parse(req.params);
            const idempotencyKey = req.headers['idempotency-key'];
            const adminId = req.user?.id || 'system';
            const fulfillment = await fulfillmentService_js_1.fulfillmentService.markFulfillmentDelivered(params.fulfillmentId, idempotencyKey, adminId);
            res.status(200).json(fulfillment);
        }
        catch (err) {
            next(err);
        }
    }
    async getFulfillmentsForOrder(req, res, next) {
        try {
            const params = schemas_js_1.getFulfillmentsParamsSchema.parse(req.params);
            const fulfillments = await fulfillmentService_js_1.fulfillmentService.getFulfillmentsForOrder(params.orderId);
            res.status(200).json(fulfillments);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.FulfillmentsController = FulfillmentsController;
exports.fulfillmentsController = new FulfillmentsController();
exports.default = exports.fulfillmentsController;
