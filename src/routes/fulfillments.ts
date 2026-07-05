import { Router } from 'express';
import { fulfillmentsController } from '../controllers/fulfillmentsController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';

const router = Router();

// Mutating endpoint to mark delivery - restricted to admin role, requires idempotency
router.post(
  '/fulfillments/:fulfillmentId/mark-delivered',
  authMiddleware,
  requireRole(['admin']),
  idempotencyMiddleware,
  fulfillmentsController.markDelivered
);

export const fulfillmentsRouter = router;
export default fulfillmentsRouter;
