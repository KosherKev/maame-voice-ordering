import { Router, Request, Response, NextFunction } from 'express';
import { ordersController } from '../controllers/ordersController.js';
import { WebhookController } from '../controllers/webhookController.js';
import { fulfillmentsController } from '../controllers/fulfillmentsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';

const router = Router();
const webhookController = new WebhookController();

/**
 * Middleware to verify Moolre / Africa's Talking shared secret query parameter
 */
function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;

  if (!key || key !== env.WEBHOOK_SHARED_SECRET) {
    return next(new WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
  }
  next();
}

// Order Query Routes
router.get('/orders', authMiddleware, ordersController.getOrders);
router.get('/orders/:orderId', authMiddleware, ordersController.getOrder);

// Mutating Order payment retry endpoint - requires auth and idempotency check
router.post(
  '/orders/:orderId/retry-payment',
  authMiddleware,
  idempotencyMiddleware,
  ordersController.retryPayment
);

// Mutating Order cancellation endpoint - requires auth and idempotency check
router.post(
  '/orders/:orderId/cancel',
  authMiddleware,
  idempotencyMiddleware,
  ordersController.cancelOrder
);

// Get Fulfillments for Order endpoint
router.get(
  '/orders/:orderId/fulfillments',
  authMiddleware,
  fulfillmentsController.getFulfillmentsForOrder
);

// Webhook endpoint for Moolre payment callbacks - requires query parameter key check
router.post(
  '/webhooks/moolre/payment',
  verifyWebhookSecret,
  webhookController.handleMoolrePayment
);

export const ordersRouter = router;
export default ordersRouter;
