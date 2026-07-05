import { z } from 'zod';

export const retryPaymentParamsSchema = z.object({
  orderId: z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});

export const moolrePaymentWebhookSchema = z.object({
  status: z.coerce.number(),
  code: z.string(),
  message: z.string(),
  data: z.object({
    externalref: z.string().min(1, { message: 'externalref is required' }),
    transactionid: z.string().min(1, { message: 'transactionid is required' }),
    amount: z.string().min(1, { message: 'amount is required' }),
    fee: z.string().optional(),
    networkfee: z.string().optional(),
  }),
});

export const markDeliveredParamsSchema = z.object({
  fulfillmentId: z.string().uuid({ message: 'Fulfillment ID must be a valid UUID' }),
});

export const getFulfillmentsParamsSchema = z.object({
  orderId: z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});
