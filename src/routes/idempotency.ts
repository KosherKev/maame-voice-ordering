import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { cleanupExpiredIdempotencyKeys } from '../middleware/idempotency.js';
import { UnauthorizedError } from '../errors/index.js';

const router = Router();

router.post(
  '/idempotency/cleanup',
  async (req: Request, res: Response, next: NextFunction) => {
    const key = req.query.key;

    if (!key || (key !== env.AT_WEBHOOK_SECRET && key !== env.MOOLRE_WEBHOOK_SECRET)) {
      return next(new UnauthorizedError('Invalid shared secret key'));
    }

    try {
      const deletedCount = await cleanupExpiredIdempotencyKeys();
      res.status(200).json({
        status: 'success',
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} expired idempotency keys.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

export const idempotencyRouter = router;
export default idempotencyRouter;
