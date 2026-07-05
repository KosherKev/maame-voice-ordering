"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationService = exports.ReconciliationService = void 0;
const prisma_js_1 = require("../db/prisma.js");
class ReconciliationService {
    async getSummary(startDate, endDate) {
        const paymentWhere = { status: 'success' };
        const disbursementWhere = { status: 'success' };
        const orderWhere = {
            status: {
                in: ['paid', 'vendor_notified', 'out_for_delivery', 'delivered', 'disbursed'],
            },
        };
        if (startDate) {
            const start = new Date(startDate);
            paymentWhere.createdAt = { gte: start };
            disbursementWhere.createdAt = { gte: start };
            orderWhere.createdAt = { gte: start };
        }
        if (endDate) {
            const end = new Date(endDate);
            paymentWhere.createdAt = { ...paymentWhere.createdAt, lte: end };
            disbursementWhere.createdAt = { ...disbursementWhere.createdAt, lte: end };
            orderWhere.createdAt = { ...orderWhere.createdAt, lte: end };
        }
        const paymentAgg = await prisma_js_1.prisma.payment.aggregate({
            _sum: {
                amountInPesewas: true,
                moolreFeeInPesewas: true,
            },
            where: paymentWhere,
        });
        const disbursementAgg = await prisma_js_1.prisma.disbursement.aggregate({
            _sum: {
                amountInPesewas: true,
                moolreFeeInPesewas: true,
            },
            where: disbursementWhere,
        });
        const orderAgg = await prisma_js_1.prisma.order.aggregate({
            _sum: {
                serviceFeeInPesewas: true,
            },
            where: orderWhere,
        });
        const totalCollected = paymentAgg._sum.amountInPesewas || 0;
        const totalDisbursed = disbursementAgg._sum.amountInPesewas || 0;
        const totalMoolreFees = (paymentAgg._sum.moolreFeeInPesewas || 0) + (disbursementAgg._sum.moolreFeeInPesewas || 0);
        const totalServiceFeeRevenue = orderAgg._sum.serviceFeeInPesewas || 0;
        const outstandingUnsettled = Math.max(0, totalCollected - totalDisbursed);
        return {
            totalCollectedInPesewas: totalCollected,
            totalDisbursedInPesewas: totalDisbursed,
            totalMoolreFeesInPesewas: totalMoolreFees,
            totalServiceFeeRevenueInPesewas: totalServiceFeeRevenue,
            outstandingUnsettledInPesewas: outstandingUnsettled,
        };
    }
    async getTransactions(filters) {
        const limit = filters.limit;
        let decodedCursor = null;
        if (filters.cursor) {
            try {
                decodedCursor = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
            }
            catch (err) {
                // Ignore invalid cursor
            }
        }
        const start = filters.startDate ? new Date(filters.startDate) : undefined;
        const end = filters.endDate ? new Date(filters.endDate) : undefined;
        const entries = [];
        // 1. Fetch Collections (Payments) if requested/applicable
        if (!filters.type || filters.type === 'collection') {
            const paymentWhere = {};
            if (start || end) {
                paymentWhere.createdAt = {};
                if (start)
                    paymentWhere.createdAt.gte = start;
                if (end)
                    paymentWhere.createdAt.lte = end;
            }
            if (decodedCursor && decodedCursor.type === 'collection') {
                paymentWhere.createdAt = {
                    ...paymentWhere.createdAt,
                    lte: new Date(decodedCursor.timestamp),
                };
                // Tie-breaker
                paymentWhere.id = { not: decodedCursor.id };
            }
            const payments = await prisma_js_1.prisma.payment.findMany({
                where: paymentWhere,
                take: limit + 1,
                orderBy: { createdAt: 'desc' },
            });
            payments.forEach((p) => {
                entries.push({
                    type: 'collection',
                    orderId: p.orderId,
                    amountInPesewas: p.amountInPesewas,
                    moolreFeeInPesewas: p.moolreFeeInPesewas || 0,
                    moolreTransactionId: p.moolreTransactionId || '',
                    status: p.status,
                    timestamp: p.createdAt.toISOString(),
                });
            });
        }
        // 2. Fetch Disbursements if requested/applicable
        if (!filters.type || filters.type === 'disbursement') {
            const disbursementWhere = {};
            if (start || end) {
                disbursementWhere.createdAt = {};
                if (start)
                    disbursementWhere.createdAt.gte = start;
                if (end)
                    disbursementWhere.createdAt.lte = end;
            }
            if (decodedCursor && decodedCursor.type === 'disbursement') {
                disbursementWhere.createdAt = {
                    ...disbursementWhere.createdAt,
                    lte: new Date(decodedCursor.timestamp),
                };
                // Tie-breaker
                disbursementWhere.id = { not: decodedCursor.id };
            }
            const disbursements = await prisma_js_1.prisma.disbursement.findMany({
                where: disbursementWhere,
                take: limit + 1,
                orderBy: { createdAt: 'desc' },
                include: {
                    vendorFulfillment: true,
                },
            });
            disbursements.forEach((d) => {
                entries.push({
                    type: 'disbursement',
                    orderId: d.vendorFulfillment.orderId,
                    amountInPesewas: d.amountInPesewas,
                    moolreFeeInPesewas: d.moolreFeeInPesewas || 0,
                    moolreTransactionId: d.moolreTransactionId || '',
                    status: d.status,
                    timestamp: d.createdAt.toISOString(),
                });
            });
        }
        // 3. Sort merged entries by timestamp desc
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // 4. Paginate
        const hasMore = entries.length > limit;
        const data = hasMore ? entries.slice(0, limit) : entries;
        let nextCursor = null;
        if (hasMore && data.length > 0) {
            const lastItem = data[data.length - 1];
            // Find the ID of the last item in its original table
            let lastId = '';
            if (lastItem.type === 'collection') {
                const lastPayment = await prisma_js_1.prisma.payment.findFirst({
                    where: { orderId: lastItem.orderId, createdAt: new Date(lastItem.timestamp) },
                });
                lastId = lastPayment?.id || '';
            }
            else {
                const lastDisbursement = await prisma_js_1.prisma.disbursement.findFirst({
                    where: {
                        createdAt: new Date(lastItem.timestamp),
                        vendorFulfillment: { orderId: lastItem.orderId },
                    },
                });
                lastId = lastDisbursement?.id || '';
            }
            nextCursor = Buffer.from(JSON.stringify({
                id: lastId,
                type: lastItem.type,
                timestamp: lastItem.timestamp,
            })).toString('base64');
        }
        return {
            data,
            pagination: {
                nextCursor,
                hasMore,
                limit,
            },
        };
    }
}
exports.ReconciliationService = ReconciliationService;
exports.reconciliationService = new ReconciliationService();
exports.default = exports.reconciliationService;
