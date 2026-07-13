import { Router } from 'express';
import { fulfillmentsController } from '../controllers/fulfillmentsController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Mutating endpoint to mark delivery - restricted to admin role, rate-limited, requires idempotency
router.post(
  '/fulfillments/:fulfillmentId/mark-delivered',
  authMiddleware,
  requireRole(['admin']),
  adminRateLimiter,
  idempotencyMiddleware,
  fulfillmentsController.markDelivered
);

export const fulfillmentsRouter = router;
export default fulfillmentsRouter;
