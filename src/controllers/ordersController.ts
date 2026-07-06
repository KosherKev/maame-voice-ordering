import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/paymentService.js';
import { ordersService } from '../services/ordersService.js';
import {
  retryPaymentParamsSchema,
  getOrdersQuerySchema,
  getOrderParamsSchema,
} from '../utils/schemas.js';

function sanitizeOrder(order: any, userRole?: string) {
  const sanitized = {
    ...order,
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

  if (userRole === 'admin') {
    sanitized.llmProviderUsed = order.llmProviderUsed;
  } else {
    delete sanitized.llmProviderUsed;
  }

  return sanitized;
}

export class OrdersController {
  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = getOrdersQuerySchema.parse(req.query);
      const result = await ordersService.getOrders(filters);

      const sanitizedData = result.data.map((order) => sanitizeOrder(order, req.user?.role));

      res.status(200).json({
        data: sanitizedData,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = getOrderParamsSchema.parse(req.params);
      const order = await ordersService.getOrder(params.orderId);

      const responseData = sanitizeOrder(order, req.user?.role);
      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = getOrderParamsSchema.parse(req.params);
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const order = await ordersService.cancelOrder(params.orderId, idempotencyKey);

      const responseData = sanitizeOrder(order, req.user?.role);
      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  }

  async retryPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = retryPaymentParamsSchema.parse(req.params);
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const order = await paymentService.retryPayment(params.orderId, idempotencyKey);

      const responseData = sanitizeOrder(order, req.user?.role);
      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  }
}

export const ordersController = new OrdersController();
export default ordersController;
