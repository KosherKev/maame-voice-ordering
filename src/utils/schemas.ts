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

export const getOrdersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.string().optional(),
  channel: z.enum(['voice', 'ussd']).optional(),
  since: z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});

export const getOrderParamsSchema = z.object({
  orderId: z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});

export const getCallSessionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  phone: z.string().optional(),
  since: z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});

export const getCallSessionParamsSchema = z.object({
  callSessionId: z.string().uuid({ message: 'Call Session ID must be a valid UUID' }),
});

export const getUssdSessionParamsSchema = z.object({
  ussdSessionId: z.string().uuid({ message: 'USSD Session ID must be a valid UUID' }),
});

export const getReconciliationSummaryQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
});

export const getReconciliationTransactionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: z.enum(['collection', 'disbursement']).optional(),
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
});

