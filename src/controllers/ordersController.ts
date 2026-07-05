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

      // Exclude internal-only fields from response
      const responseData = {
        ...order,
        llmProviderUsed: req.user?.role === 'admin' ? order.llmProviderUsed : undefined,
        payment: order.payment ? {
          id: order.payment.id,
          orderId: order.payment.orderId,
          moolreTransactionId: order.payment.moolreTransactionId,
          amountInPesewas: order.payment.amountInPesewas,
          moolreFeeInPesewas: order.payment.moolreFeeInPesewas,
          status: order.payment.status,
          createdAt: order.payment.createdAt,
        } : null,
      };

      if (responseData.llmProviderUsed === undefined) {
        delete (responseData as any).llmProviderUsed;
      }

      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  }
}

export default OrdersController;
