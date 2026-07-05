import { Router } from 'express';
import { reconciliationController } from '../controllers/reconciliationController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/reconciliation/summary', authMiddleware, reconciliationController.getSummary);
router.get('/reconciliation/transactions', authMiddleware, reconciliationController.getTransactions);

export const reconciliationRouter = router;
export default reconciliationRouter;
