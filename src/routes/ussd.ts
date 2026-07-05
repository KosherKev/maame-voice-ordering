import { Router, Request, Response, NextFunction } from 'express';
import { ussdController } from '../controllers/ussdController.js';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';
import { webhookRateLimiter, adminRateLimiter } from '../middleware/rateLimiter.js';
import { moolreIpAllowlist } from '../middleware/ipAllowlist.js';

const router = Router();

/**
 * Shared-secret guard for Moolre USSD inbound webhook (§10, G-9).
 * The shared secret is appended to the registered callback URL as ?key=<secret>.
 * Moolre source-IP allowlisting is enforced by the moolreIpAllowlist middleware.
 */
function verifyUssdWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;
  if (!key || key !== env.MOOLRE_WEBHOOK_SECRET) {
    return next(
      new WebhookSignatureInvalidError(
        'Unauthorized USSD webhook access: invalid or missing secret key',
      ),
    );
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
router.post(
  '/webhooks/ussd/inbound',
  webhookRateLimiter,
  moolreIpAllowlist,
  verifyUssdWebhookSecret,
  ussdController.inboundUssdWebhook,
);

// ---------------------------------------------------------------------------
// Admin read endpoints (auth: bearer, §5.7)
// ---------------------------------------------------------------------------

/**
 * GET /v1/ussd-sessions
 * Query: ?limit&cursor&phone&since
 */
router.get('/ussd-sessions', authMiddleware, adminRateLimiter, ussdController.getUssdSessions);

/**
 * GET /v1/ussd-sessions/:ussdSessionId
 * Returns USSDSession including menu-state history.
 * sessionIdMoolre excluded (internal-only per §9).
 */
router.get('/ussd-sessions/:ussdSessionId', authMiddleware, adminRateLimiter, ussdController.getUssdSession);

export { router as ussdRouter };
export default router;
