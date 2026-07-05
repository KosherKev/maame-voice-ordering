import { Router, Request, Response, NextFunction } from 'express';
import { ussdController } from '../controllers/ussdController.js';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';

const router = Router();

/**
 * Shared-secret guard for Moolre USSD inbound webhook (§10, G-9).
 * The shared secret is appended to the registered callback URL as ?key=<secret>.
 * Moolre source-IP allowlisting should be configured at the load-balancer / firewall
 * level as an additional compensating control (not enforced here in code, per G-9 resolution).
 */
function verifyUssdWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;
  if (!key || key !== env.WEBHOOK_SHARED_SECRET) {
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
 * Auth: shared secret query param + Moolre source-IP allowlist (§10).
 * G-7 FLAG: request body field names must be confirmed against Moolre sandbox.
 */
router.post(
  '/webhooks/ussd/inbound',
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
router.get('/ussd-sessions', authMiddleware, ussdController.getUssdSessions);

/**
 * GET /v1/ussd-sessions/:ussdSessionId
 * Returns USSDSession including menu-state history.
 * sessionIdMoolre excluded (internal-only per §9).
 */
router.get('/ussd-sessions/:ussdSessionId', authMiddleware, ussdController.getUssdSession);

export { router as ussdRouter };
export default router;
