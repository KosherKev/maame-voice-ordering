"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ussdRouter = void 0;
const express_1 = require("express");
const ussdController_js_1 = require("../controllers/ussdController.js");
const auth_js_1 = require("../middleware/auth.js");
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../errors/index.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const ipAllowlist_js_1 = require("../middleware/ipAllowlist.js");
const router = (0, express_1.Router)();
exports.ussdRouter = router;
/**
 * Shared-secret guard for Moolre USSD inbound webhook (§10, G-9).
 * The shared secret is appended to the registered callback URL as ?key=<secret>.
 * Moolre source-IP allowlisting is enforced by the moolreIpAllowlist middleware.
 */
function verifyUssdWebhookSecret(req, res, next) {
    const { key } = req.query;
    if (!key || key !== env_js_1.env.MOOLRE_WEBHOOK_SECRET) {
        return next(new index_js_1.WebhookSignatureInvalidError('Unauthorized USSD webhook access: invalid or missing secret key'));
    }
    next();
}
// ---------------------------------------------------------------------------
// Webhook endpoint (unauthenticated — external Moolre provider, not staff)
// ---------------------------------------------------------------------------
/**
 * POST /v1/webhooks/ussd/inbound
 * Security: rate limiter → IP allowlist → shared secret → handler (§10, G-9)
 * G-7 FLAG: request body field names must be confirmed against Moolre sandbox.
 */
router.post('/webhooks/ussd/inbound', rateLimiter_js_1.webhookRateLimiter, ipAllowlist_js_1.moolreIpAllowlist, verifyUssdWebhookSecret, ussdController_js_1.ussdController.inboundUssdWebhook);
// ---------------------------------------------------------------------------
// Admin read endpoints (auth: bearer, §5.7)
// ---------------------------------------------------------------------------
/**
 * GET /v1/ussd-sessions
 * Query: ?limit&cursor&phone&since
 */
router.get('/ussd-sessions', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, ussdController_js_1.ussdController.getUssdSessions);
/**
 * GET /v1/ussd-sessions/:ussdSessionId
 * Returns USSDSession including menu-state history.
 * sessionIdMoolre excluded (internal-only per §9).
 */
router.get('/ussd-sessions/:ussdSessionId', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, ussdController_js_1.ussdController.getUssdSession);
exports.default = router;
