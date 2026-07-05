import { Request, Response, NextFunction } from 'express';
import { fulfillmentService } from '../services/fulfillmentService.js';
import { markDeliveredParamsSchema, getFulfillmentsParamsSchema } from '../utils/schemas.js';

export class FulfillmentsController {
  async markDelivered(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = markDeliveredParamsSchema.parse(req.params);
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const adminId = req.user?.id || 'system';

      const fulfillment = await fulfillmentService.markFulfillmentDelivered(
        params.fulfillmentId,
        idempotencyKey,
        adminId,
      );

      res.status(200).json(fulfillment);
    } catch (err) {
      next(err);
    }
  }

  async getFulfillmentsForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = getFulfillmentsParamsSchema.parse(req.params);

      const fulfillments = await fulfillmentService.getFulfillmentsForOrder(params.orderId);

      res.status(200).json(fulfillments);
    } catch (err) {
      next(err);
    }
  }
}

export const fulfillmentsController = new FulfillmentsController();
export default fulfillmentsController;
