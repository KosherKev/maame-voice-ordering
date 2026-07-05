import { z } from 'zod';

/**
 * G-7 FLAG: Moolre USSD inbound webhook shape.
 * The public Moolre reference is minimal for the USSD inbound hook. The fields
 * below are derived from the Moolre API reference (llms-full.txt) and common
 * USSD session-protocol conventions (sessionid, msisdn, text, type).
 * MUST be verified against a live Moolre sandbox before Phase 7 goes to
 * production — do not treat field names as confirmed. Update this schema
 * and ussdService.ts if the live shape differs.
 */
export const moolreUssdInboundSchema = z.object({
  /** Moolre session identifier — correlates multi-turn USSD dialog */
  sessionid: z.string().min(1, { message: 'sessionid is required' }),
  /** Customer MSISDN (phone number) */
  msisdn: z.string().min(1, { message: 'msisdn (customer phone) is required' }),
  /** The accumulated USSD input string for this session (e.g. "1*2*3") */
  text: z.string().default(''),
  /** Session lifecycle indicator: 1 = new/continuing, 2 = end (session terminated by network) */
  type: z.coerce.number().int().optional(),
  /** Service code dialled by the customer (e.g. *203#) */
  serviceCode: z.string().optional(),
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

