// Trigger environment variable validation immediately on boot
import { env } from './config/env.js';
import { app } from './app.js';

const port = env.PORT;

app.listen(port, () => {
  console.log(`🚀 Maame API server booted and listening on port ${port} in ${env.NODE_ENV} mode`);
});
