"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReconciliationTransactionsQuerySchema = exports.getReconciliationSummaryQuerySchema = exports.getUssdSessionParamsSchema = exports.getCallSessionParamsSchema = exports.getCallSessionsQuerySchema = exports.getOrderParamsSchema = exports.getOrdersQuerySchema = exports.getFulfillmentsParamsSchema = exports.markDeliveredParamsSchema = exports.moolrePaymentWebhookSchema = exports.retryPaymentParamsSchema = exports.getUssdSessionsQuerySchema = exports.moolreUssdInboundSchema = void 0;
const zod_1 = require("zod");
/**
 * Moolre USSD inbound webhook shape — confirmed from the live Moolre dashboard
 * simulator (G-7 resolved). Field names and types verified against the simulator
 * payload reference and Moolre's docs. See contract §5.8 for the full payload table.
 */
exports.moolreUssdInboundSchema = zod_1.z.object({
    /** Unique session ID — correlates all turns of one dial */
    sessionId: zod_1.z.string().min(1, { message: 'sessionId is required' }),
    /** true on the first turn of a session, false on continuations */
    new: zod_1.z.boolean(),
    /** Customer MSISDN (phone number) */
    msisdn: zod_1.z.string().min(1, { message: 'msisdn (customer phone) is required' }),
    /** Network code: 3 = MTN, 5 = AirtelTigo, 6 = Telecel */
    network: zod_1.z.number().int(),
    /** Customer's input text (empty string on the first turn) */
    message: zod_1.z.string().default(''),
    /** The shared-code extension assigned to Maame (e.g. "109" for *203*109#) */
    extension: zod_1.z.string().optional(),
    /** Extra digits dialled at initiation (e.g. *203*109*11005# → data = "11005") */
    data: zod_1.z.string().optional(),
});
exports.getUssdSessionsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    since: zod_1.z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});
exports.retryPaymentParamsSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});
exports.moolrePaymentWebhookSchema = zod_1.z.object({
    status: zod_1.z.coerce.number(),
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    data: zod_1.z.object({
        externalref: zod_1.z.string().min(1, { message: 'externalref is required' }),
        transactionid: zod_1.z.string().min(1, { message: 'transactionid is required' }),
        amount: zod_1.z.string().min(1, { message: 'amount is required' }),
        fee: zod_1.z.string().optional(),
        networkfee: zod_1.z.string().optional(),
    }),
});
exports.markDeliveredParamsSchema = zod_1.z.object({
    fulfillmentId: zod_1.z.string().uuid({ message: 'Fulfillment ID must be a valid UUID' }),
});
exports.getFulfillmentsParamsSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});
exports.getOrdersQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    channel: zod_1.z.enum(['voice', 'ussd']).optional(),
    since: zod_1.z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});
exports.getOrderParamsSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid({ message: 'Order ID must be a valid UUID' }),
});
exports.getCallSessionsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    since: zod_1.z.string().datetime({ message: 'since must be a valid ISO 8601 datetime' }).optional(),
});
exports.getCallSessionParamsSchema = zod_1.z.object({
    callSessionId: zod_1.z.string().uuid({ message: 'Call Session ID must be a valid UUID' }),
});
exports.getUssdSessionParamsSchema = zod_1.z.object({
    ussdSessionId: zod_1.z.string().uuid({ message: 'USSD Session ID must be a valid UUID' }),
});
exports.getReconciliationSummaryQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
    endDate: zod_1.z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
});
exports.getReconciliationTransactionsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(),
    type: zod_1.z.enum(['collection', 'disbursement']).optional(),
    startDate: zod_1.z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
    endDate: zod_1.z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
});
