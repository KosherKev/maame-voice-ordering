"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const ordersController_js_1 = require("../controllers/ordersController.js");
const webhookController_js_1 = require("../controllers/webhookController.js");
const fulfillmentsController_js_1 = require("../controllers/fulfillmentsController.js");
const auth_js_1 = require("../middleware/auth.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../errors/index.js");
const ipAllowlist_js_1 = require("../middleware/ipAllowlist.js");
const router = (0, express_1.Router)();
const webhookController = new webhookController_js_1.WebhookController();
/**
 * Middleware to verify Moolre shared secret query parameter (§10, G-9).
 */
function verifyMoolreWebhookSecret(req, res, next) {
    const { key } = req.query;
    if (!key || key !== env_js_1.env.MOOLRE_WEBHOOK_SECRET) {
        return next(new index_js_1.WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
    }
    next();
}
// Order Query Routes (admin, rate-limited)
router.get('/orders', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, ordersController_js_1.ordersController.getOrders);
router.get('/orders/:orderId', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, ordersController_js_1.ordersController.getOrder);
// Mutating Order payment retry endpoint - requires auth, rate limit, and idempotency check
router.post('/orders/:orderId/retry-payment', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, idempotency_js_1.idempotencyMiddleware, ordersController_js_1.ordersController.retryPayment);
// Mutating Order cancellation endpoint - requires auth, rate limit, and idempotency check
router.post('/orders/:orderId/cancel', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, idempotency_js_1.idempotencyMiddleware, ordersController_js_1.ordersController.cancelOrder);
// Get Fulfillments for Order endpoint
router.get('/orders/:orderId/fulfillments', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, fulfillmentsController_js_1.fulfillmentsController.getFulfillmentsForOrder);
// Webhook endpoint for Moolre payment callbacks
// Security: rate limiter → IP allowlist → shared secret → handler (§10, G-9)
router.post('/webhooks/moolre/payment', rateLimiter_js_1.webhookRateLimiter, ipAllowlist_js_1.moolreIpAllowlist, verifyMoolreWebhookSecret, webhookController.handleMoolrePayment);
exports.ordersRouter = router;
exports.default = exports.ordersRouter;
