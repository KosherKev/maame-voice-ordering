"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsService = exports.SessionsService = void 0;
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../errors/index.js");
class SessionsService {
    async getCallSessions(filters) {
        const where = {};
        if (filters.phone) {
            where.customerPhone = filters.phone;
        }
        if (filters.since) {
            where.createdAt = { gt: new Date(filters.since) };
        }
        let prismaCursor = undefined;
        if (filters.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
                if (decoded && decoded.id) {
                    prismaCursor = { id: decoded.id };
                }
            }
            catch (err) {
                // Fallback for invalid cursors
            }
        }
        const limit = filters.limit;
        const items = await prisma_js_1.prisma.callSession.findMany({
            where,
            take: limit + 1,
            skip: prismaCursor ? 1 : 0,
            cursor: prismaCursor,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                customerPhone: true,
                status: true,
                orderId: true,
                createdAt: true,
                endedAt: true,
            },
        });
        const hasMore = items.length > limit;
        const data = (hasMore ? items.slice(0, limit) : items);
        let nextCursor = null;
        if (hasMore && data.length > 0) {
            const lastItem = data[data.length - 1];
            nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
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
    async getCallSession(id) {
        const session = await prisma_js_1.prisma.callSession.findUnique({
            where: { id },
        });
        if (!session) {
            throw new index_js_1.NotFoundError(`Call Session not found: ${id}`);
        }
        return session;
    }
    async getUssdSession(id) {
        const session = await prisma_js_1.prisma.uSSDSession.findUnique({
            where: { id },
        });
        if (!session) {
            throw new index_js_1.NotFoundError(`USSD Session not found: ${id}`);
        }
        return session;
    }
}
exports.SessionsService = SessionsService;
exports.sessionsService = new SessionsService();
exports.default = exports.sessionsService;
