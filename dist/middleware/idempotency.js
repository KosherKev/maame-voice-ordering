"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotencyMiddleware = idempotencyMiddleware;
exports.cleanupExpiredIdempotencyKeys = cleanupExpiredIdempotencyKeys;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../errors/index.js");
async function idempotencyMiddleware(req, res, next) {
    // Only enforce on mutating admin endpoints (POST, PATCH) as per contract
    if (req.method !== 'POST' && req.method !== 'PATCH') {
        return next();
    }
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
        return next(new index_js_1.ValidationError('Idempotency-Key header is required for mutating requests'));
    }
    if (typeof idempotencyKey !== 'string') {
        return next(new index_js_1.ValidationError('Idempotency-Key header must be a string'));
    }
    // Validate UUID v4
    const uuidSchema = zod_1.z.string().uuid();
    const uuidParse = uuidSchema.safeParse(idempotencyKey);
    if (!uuidParse.success) {
        return next(new index_js_1.ValidationError('Idempotency-Key header must be a valid UUID v4'));
    }
    const incomingBodyStr = JSON.stringify(req.body);
    const requestBodyHash = (0, crypto_1.createHash)('sha256').update(incomingBodyStr).digest('hex');
    try {
        const cached = await prisma_js_1.prisma.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
        });
        if (cached) {
            // Check if the key has expired
            if (new Date() > cached.expiresAt) {
                // Delete expired key and proceed as a new request
                await prisma_js_1.prisma.idempotencyKey.delete({
                    where: { key: idempotencyKey },
                }).catch((err) => {
                    console.warn('Failed to delete expired idempotency key:', err);
                });
            }
            else {
                // If key is reused with a different body, it's a conflict
                if (cached.requestBodyHash !== requestBodyHash) {
                    return next(new index_js_1.IdempotencyConflictError());
                }
                // Replay the cached response
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Cache-Lookup', 'HIT - Idempotent');
                return res.status(cached.responseStatus).send(cached.responseBody);
            }
        }
    }
    catch (err) {
        console.error('Error querying idempotency store:', err);
        // Proceed if db check fails to prevent blocking requests, or we could fail.
        // In production, we usually prefer to proceed or fail. Let's proceed but log.
    }
    // Intercept response to cache it on successful/client-error response (status < 500)
    const originalSend = res.send;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.send = function (body) {
        const handleUpsertAndSend = async () => {
            if (res.statusCode < 500) {
                const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours TTL
                try {
                    await prisma_js_1.prisma.idempotencyKey.upsert({
                        where: { key: idempotencyKey },
                        create: {
                            key: idempotencyKey,
                            requestBodyHash,
                            responseStatus: res.statusCode,
                            responseBody,
                            expiresAt,
                        },
                        update: {
                            requestBodyHash,
                            responseStatus: res.statusCode,
                            responseBody,
                            expiresAt,
                        },
                    });
                }
                catch (err) {
                    console.error('Error writing to idempotency store:', err);
                }
            }
            return originalSend.call(this, body);
        };
        handleUpsertAndSend();
        return this;
    };
    next();
}
/**
 * Utility function to clean up expired idempotency keys from the database.
 */
async function cleanupExpiredIdempotencyKeys() {
    const result = await prisma_js_1.prisma.idempotencyKey.deleteMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
        },
    });
    return result.count;
}
