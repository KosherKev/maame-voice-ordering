// Trigger environment variable validation immediately on boot
import { env } from './config/env.js';
import { app } from './app.js';
import { sweepAbandonedSessions } from './jobs/sessionSweep.js';

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
});

