import { z } from 'zod';

/**
 * Moolre USSD inbound webhook shape — confirmed from the live Moolre dashboard
 * simulator (G-7 resolved). Field names and types verified against the simulator
 * payload reference and Moolre's docs. See contract §5.8 for the full payload table.
 */
export const moolreUssdInboundSchema = z.object({
  /** Unique session ID — correlates all turns of one dial */
  sessionId: z.string().min(1, { message: 'sessionId is required' }),
  /** true on the first turn of a session, false on continuations */
  new: z.boolean(),
  /** Customer MSISDN (phone number) */
  msisdn: z.string().min(1, { message: 'msisdn (customer phone) is required' }),
  /** Network code: 3 = MTN, 5 = AirtelTigo, 6 = Telecel */
  network: z.number().int(),
  /** Customer's input text (empty string on the first turn) */
  message: z.string().default(''),
  /** The shared-code extension assigned to Maame (e.g. "109" for *203*109#) */
  extension: z.string().optional(),
  /** Extra digits dialled at initiation (e.g. *203*109*11005# → data = "11005") */
  data: z.string().optional(),
});

export type MoolreUssdInboundPayload = z.infer<typeof moolreUssdInboundSchema>;

export const getUssdSessionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  phone: z.string().optional(),
  since: z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});

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

