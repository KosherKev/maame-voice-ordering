"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFulfillmentsParamsSchema = exports.markDeliveredParamsSchema = exports.moolrePaymentWebhookSchema = exports.retryPaymentParamsSchema = void 0;
const zod_1 = require("zod");
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
