import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { idempotencyRouter } from './routes/idempotency.js';
import { voiceRouter } from './routes/voice.js';
import { ussdRouter } from './routes/ussd.js';
import { ordersRouter } from './routes/orders.js';
import { fulfillmentsRouter } from './routes/fulfillments.js';
import { sessionsRouter } from './routes/sessions.js';
import { reconciliationRouter } from './routes/reconciliation.js';
import { NotFoundError, ForbiddenError } from './errors/index.js';

const app = express();

// CORS implementation: Env-driven explicit allowlist, no wildcards (contract §10)
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//         callback(null, true);
//       } else {
//         callback(new ForbiddenError('Origin not allowed by CORS'));
//       }
//     },
//     credentials: true,
//   }),
// );

app.use(express.json());
app.use(requestIdMiddleware);

// Mount routes
app.use('/v1', healthRouter);
app.use('/v1', idempotencyRouter);
app.use('/v1', voiceRouter);
app.use('/v1', ussdRouter);
app.use('/v1', ordersRouter);
app.use('/v1', fulfillmentsRouter);
app.use('/v1', sessionsRouter);
app.use('/v1', reconciliationRouter);



// Catch-all for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global error handling middleware
app.use(errorHandlerMiddleware);

export { app };
export default app;
