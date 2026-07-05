"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const prisma_js_1 = require("../db/prisma.js");
const webhookLogger_js_1 = require("../utils/webhookLogger.js");
const schemas_js_1 = require("../utils/schemas.js");
const fulfillmentService_js_1 = require("../services/fulfillmentService.js");
class WebhookController {
    async handleMoolrePayment(req, res, next) {
        try {
            // 1. Log webhook event (redacted automatically)
            await (0, webhookLogger_js_1.logWebhookEvent)('moolre', req.body);
            // 2. Validate request body against schema
            const payload = schemas_js_1.moolrePaymentWebhookSchema.parse(req.body);
            const { status, code, data } = payload;
            // 3. Find payment by externalref
            const payment = await prisma_js_1.prisma.payment.findUnique({
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
            await prisma_js_1.prisma.$transaction([
                prisma_js_1.prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: isSuccess ? 'success' : 'failed',
                        moolreTransactionId: data.transactionid,
                        moolreFeeInPesewas: data.fee ? Math.round(parseFloat(data.fee) * 100) : null,
                    },
                }),
                prisma_js_1.prisma.order.update({
                    where: { id: payment.orderId },
                    data: {
                        status: isSuccess ? 'paid' : 'payment_failed',
                    },
                }),
            ]);
            // If payment is successful, trigger vendor notification & fulfillment creation
            if (isSuccess) {
                fulfillmentService_js_1.fulfillmentService.processOrderPaid(payment.orderId).catch((err) => {
                    console.error(`❌ Failed to process paid order ${payment.orderId} fulfillment:`, err);
                });
            }
            res.status(200).send();
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WebhookController = WebhookController;
exports.default = WebhookController;
