"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const ordersController_js_1 = require("../controllers/ordersController.js");
const webhookController_js_1 = require("../controllers/webhookController.js");
const fulfillmentsController_js_1 = require("../controllers/fulfillmentsController.js");
const auth_js_1 = require("../middleware/auth.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../errors/index.js");
const router = (0, express_1.Router)();
const ordersController = new ordersController_js_1.OrdersController();
const webhookController = new webhookController_js_1.WebhookController();
/**
 * Middleware to verify Moolre / Africa's Talking shared secret query parameter
 */
function verifyWebhookSecret(req, res, next) {
    const { key } = req.query;
    if (!key || key !== env_js_1.env.WEBHOOK_SHARED_SECRET) {
        return next(new index_js_1.WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
    }
    next();
}
// Mutating Order payment retry endpoint - requires auth and idempotency check
router.post('/orders/:orderId/retry-payment', auth_js_1.authMiddleware, idempotency_js_1.idempotencyMiddleware, ordersController.retryPayment);
// Get Fulfillments for Order endpoint
router.get('/orders/:orderId/fulfillments', auth_js_1.authMiddleware, fulfillmentsController_js_1.fulfillmentsController.getFulfillmentsForOrder);
// Webhook endpoint for Moolre payment callbacks - requires query parameter key check
router.post('/webhooks/moolre/payment', verifyWebhookSecret, webhookController.handleMoolrePayment);
exports.ordersRouter = router;
exports.default = exports.ordersRouter;
