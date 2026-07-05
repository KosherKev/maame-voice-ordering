import { Request, Response, NextFunction } from 'express';
import { reconciliationService } from '../services/reconciliationService.js';
import {
  getReconciliationSummaryQuerySchema,
  getReconciliationTransactionsQuerySchema,
} from '../utils/schemas.js';

export class ReconciliationController {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = getReconciliationSummaryQuerySchema.parse(req.query);
      const summary = await reconciliationService.getSummary(
        filters.startDate,
        filters.endDate,
      );

      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = getReconciliationTransactionsQuerySchema.parse(req.query);
      const result = await reconciliationService.getTransactions(filters as any);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const reconciliationController = new ReconciliationController();
export default reconciliationController;
