import { Router } from 'express';
import { reconciliationController } from '../controllers/reconciliationController.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Reconciliation endpoints (§5.6) — admin auth + rate-limited
router.get('/reconciliation/summary', authMiddleware, adminRateLimiter, reconciliationController.getSummary);
router.get('/reconciliation/transactions', authMiddleware, adminRateLimiter, reconciliationController.getTransactions);

export const reconciliationRouter = router;
export default reconciliationRouter;
