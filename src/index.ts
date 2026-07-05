// Trigger environment variable validation immediately on boot
import { env } from './config/env.js';
import { app } from './app.js';
import { sweepAbandonedSessions } from './jobs/sessionSweep.js';
import { runDisbursementPoll } from './jobs/disbursementPoll.js';

const port = env.PORT;

app.listen(port, () => {
  console.log(`🚀 Maame API server booted and listening on port ${port} in ${env.NODE_ENV} mode`);
  
  // Start the background job for sweeping abandoned sessions (G-4)
  const SWEEP_INTERVAL_MS = 30000; // 30 seconds
  setInterval(async () => {
    try {
      const sweptCount = await sweepAbandonedSessions();
      if (sweptCount > 0) {
        console.log(`🧹 Swept ${sweptCount} idle/abandoned sessions.`);
      }
    } catch (err) {
      console.error('Failed to run session sweep interval:', err);
    }
  }, SWEEP_INTERVAL_MS);

  // Start the background job for polling pending disbursements/transfers status (G-3)
  const DISBURSEMENT_POLL_INTERVAL_MS = 30000; // 30 seconds
  setInterval(async () => {
    try {
      await runDisbursementPoll();
    } catch (err) {
      console.error('Failed to run disbursement status polling interval:', err);
    }
  }, DISBURSEMENT_POLL_INTERVAL_MS);
});

