import { Router, Request, Response, NextFunction } from 'express';
import { ordersController } from '../controllers/ordersController.js';
import { WebhookController } from '../controllers/webhookController.js';
import { fulfillmentsController } from '../controllers/fulfillmentsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { webhookRateLimiter, adminRateLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';
import { moolreIpAllowlist } from '../middleware/ipAllowlist.js';

const router = Router();
const webhookController = new WebhookController();

/**
 * Middleware to verify Moolre shared secret query parameter (§10, G-9).
 */
function verifyMoolreWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;

  if (!key || key !== env.MOOLRE_WEBHOOK_SECRET) {
    return next(new WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
  }
  next();
}

// Order Query Routes (admin, rate-limited)
router.get('/orders', authMiddleware, adminRateLimiter, ordersController.getOrders);
router.get('/orders/:orderId', authMiddleware, adminRateLimiter, ordersController.getOrder);

// Mutating Order payment retry endpoint - requires auth, rate limit, and idempotency check
router.post(
  '/orders/:orderId/retry-payment',
  authMiddleware,
  adminRateLimiter,
  idempotencyMiddleware,
  ordersController.retryPayment
);

// Mutating Order cancellation endpoint - requires auth, rate limit, and idempotency check
router.post(
  '/orders/:orderId/cancel',
  authMiddleware,
  adminRateLimiter,
  idempotencyMiddleware,
  ordersController.cancelOrder
);

// Get Fulfillments for Order endpoint
router.get(
  '/orders/:orderId/fulfillments',
  authMiddleware,
  adminRateLimiter,
  fulfillmentsController.getFulfillmentsForOrder
);

// Webhook endpoint for Moolre payment callbacks
// Security: rate limiter → IP allowlist → shared secret → handler (§10, G-9)
router.post(
  '/webhooks/moolre/payment',
  webhookRateLimiter,
  moolreIpAllowlist,
  verifyMoolreWebhookSecret,
  webhookController.handleMoolrePayment
);

export const ordersRouter = router;
export default ordersRouter;
