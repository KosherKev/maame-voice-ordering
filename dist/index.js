"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_js_1 = require("./config/env.js");
const app_js_1 = require("./app.js");
const sessionSweep_js_1 = require("./jobs/sessionSweep.js");
const disbursementPoll_js_1 = require("./jobs/disbursementPoll.js");
const idempotency_js_1 = require("./middleware/idempotency.js");
const port = env_js_1.env.PORT;
app_js_1.app.listen(port, () => {
    console.log(`🚀 Maame API server booted and listening on port ${port} in ${env_js_1.env.NODE_ENV} mode`);
    // Start the background job for sweeping abandoned sessions (G-4)
    const SWEEP_INTERVAL_MS = 30000; // 30 seconds
    setInterval(async () => {
        try {
            const sweptCount = await (0, sessionSweep_js_1.sweepAbandonedSessions)();
            if (sweptCount > 0) {
                console.log(`🧹 Swept ${sweptCount} idle/abandoned sessions.`);
            }
        }
        catch (err) {
            console.error('Failed to run session sweep interval:', err);
        }
    }, SWEEP_INTERVAL_MS);
    // Start the background job for polling pending disbursements/transfers status (G-3)
    const DISBURSEMENT_POLL_INTERVAL_MS = 30000; // 30 seconds
    setInterval(async () => {
        try {
            await (0, disbursementPoll_js_1.runDisbursementPoll)();
        }
        catch (err) {
            console.error('Failed to run disbursement status polling interval:', err);
        }
    }, DISBURSEMENT_POLL_INTERVAL_MS);
    // Start the background job for cleaning up expired idempotency keys (A-6)
    const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
        try {
            const deletedCount = await (0, idempotency_js_1.cleanupExpiredIdempotencyKeys)();
            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} expired idempotency keys.`);
            }
        }
        catch (err) {
            console.error('Failed to run idempotency keys cleanup interval:', err);
        }
    }, IDEMPOTENCY_CLEANUP_INTERVAL_MS);
});
