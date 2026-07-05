import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/paymentService.js';
import { retryPaymentParamsSchema } from '../utils/schemas.js';

export class OrdersController {
  async retryPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate path parameter
      const params = retryPaymentParamsSchema.parse(req.params);

      // Get Idempotency-Key from headers
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const order = await paymentService.retryPayment(params.orderId, idempotencyKey);

      res.status(200).json(order);
    } catch (err) {
      next(err);
    }
  }
}

export default OrdersController;
