import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { logWebhookEvent } from '../utils/webhookLogger.js';
import { moolrePaymentWebhookSchema } from '../utils/schemas.js';
import { fulfillmentService } from '../services/fulfillmentService.js';

export class WebhookController {
  async handleMoolrePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Log webhook event (redacted automatically)
      await logWebhookEvent('moolre', req.body);

      // 2. Validate request body against schema
      const payload = moolrePaymentWebhookSchema.parse(req.body);

      const { status, code, data } = payload;

      // 3. Find payment by externalref
      const payment = await prisma.payment.findUnique({
        where: { externalref: data.externalref },
      });

      if (!payment) {
        // Log warning but return 200 to acknowledge webhook
        console.warn(`Payment not found for Moolre webhook externalref: ${data.externalref}`);
        res.status(200).send();
        return;
      }

      const isSuccess = status === 1 && code === 'P01';

      // 4. Update payment and order status atomically
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: isSuccess ? 'success' : 'failed',
            moolreTransactionId: data.transactionid,
            moolreFeeInPesewas: data.fee ? Math.round(parseFloat(data.fee) * 100) : null,
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: isSuccess ? 'paid' : 'payment_failed',
          },
        }),
      ]);

      // If payment is successful, trigger vendor notification & fulfillment creation
      if (isSuccess) {
        fulfillmentService.processOrderPaid(payment.orderId).catch((err) => {
          console.error(`❌ Failed to process paid order ${payment.orderId} fulfillment:`, err);
        });
      }

      res.status(200).send();
    } catch (err) {
      next(err);
    }
  }
}

export default WebhookController;
