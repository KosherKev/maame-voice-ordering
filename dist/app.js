"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_js_1 = require("./config/env.js");
const requestId_js_1 = require("./middleware/requestId.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const health_js_1 = require("./routes/health.js");
const idempotency_js_1 = require("./routes/idempotency.js");
const voice_js_1 = require("./routes/voice.js");
const ussd_js_1 = require("./routes/ussd.js");
const orders_js_1 = require("./routes/orders.js");
const fulfillments_js_1 = require("./routes/fulfillments.js");
const sessions_js_1 = require("./routes/sessions.js");
const reconciliation_js_1 = require("./routes/reconciliation.js");
const index_js_1 = require("./errors/index.js");
const app = (0, express_1.default)();
exports.app = app;
// CORS implementation: Env-driven explicit allowlist, no wildcards (contract §10)
const allowedOrigins = env_js_1.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new index_js_1.ForbiddenError('Origin not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(requestId_js_1.requestIdMiddleware);
// Mount routes
app.use('/v1', health_js_1.healthRouter);
app.use('/v1', idempotency_js_1.idempotencyRouter);
app.use('/v1', voice_js_1.voiceRouter);
app.use('/v1', ussd_js_1.ussdRouter);
app.use('/v1', orders_js_1.ordersRouter);
app.use('/v1', fulfillments_js_1.fulfillmentsRouter);
app.use('/v1', sessions_js_1.sessionsRouter);
app.use('/v1', reconciliation_js_1.reconciliationRouter);
// Catch-all for undefined routes
app.use((req, res, next) => {
    next(new index_js_1.NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});
// Global error handling middleware
app.use(errorHandler_js_1.errorHandlerMiddleware);
exports.default = app;
