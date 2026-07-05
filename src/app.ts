import express from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { idempotencyRouter } from './routes/idempotency.js';
import { voiceRouter } from './routes/voice.js';
import { ordersRouter } from './routes/orders.js';
import { fulfillmentsRouter } from './routes/fulfillments.js';
import { NotFoundError, ForbiddenError } from './errors/index.js';

const app = express();

// CORS implementation: Explicit allowlist, no wildcards
const allowedOrigins = [
  'http://localhost:5173', // Vite dashboard dev server
  'http://localhost:3000', // Alternative port
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new ForbiddenError('Origin not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(requestIdMiddleware);

// Mount routes
app.use('/v1', healthRouter);
app.use('/v1', idempotencyRouter);
app.use('/v1', voiceRouter);
app.use('/v1', ordersRouter);
app.use('/v1', fulfillmentsRouter);



// Catch-all for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global error handling middleware
app.use(errorHandlerMiddleware);

export { app };
export default app;
