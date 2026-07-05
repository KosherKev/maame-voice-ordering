"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotencyRouter = void 0;
const express_1 = require("express");
const env_js_1 = require("../config/env.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
const index_js_1 = require("../errors/index.js");
const router = (0, express_1.Router)();
router.post('/idempotency/cleanup', async (req, res, next) => {
    const key = req.query.key;
    if (!key || key !== env_js_1.env.WEBHOOK_SHARED_SECRET) {
        return next(new index_js_1.UnauthorizedError('Invalid shared secret key'));
    }
    try {
        const deletedCount = await (0, idempotency_js_1.cleanupExpiredIdempotencyKeys)();
        res.status(200).json({
            status: 'success',
            deletedCount,
            message: `Successfully cleaned up ${deletedCount} expired idempotency keys.`,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.idempotencyRouter = router;
exports.default = exports.idempotencyRouter;
