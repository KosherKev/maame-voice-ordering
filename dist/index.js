"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Trigger environment variable validation immediately on boot
const env_js_1 = require("./config/env.js");
const app_js_1 = require("./app.js");
const sessionSweep_js_1 = require("./jobs/sessionSweep.js");
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
});
