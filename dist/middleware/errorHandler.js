"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerMiddleware = errorHandlerMiddleware;
const zod_1 = require("zod");
const index_js_1 = require("../errors/index.js");
function errorHandlerMiddleware(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) {
    const isDomainError = err instanceof index_js_1.DomainError;
    if (isDomainError) {
        const status = err.status;
        res.setHeader('Content-Type', 'application/problem+json');
        const body = {
            type: `https://api.maame.app/problems/${err.typeSuffix}`,
            title: err.title,
            status,
            detail: err.message,
            instance: req.originalUrl,
        };
        if (err instanceof index_js_1.ValidationError && err.errors) {
            body.errors = err.errors;
        }
        return res.status(status).json(body);
    }
    // Handle Zod validation errors → 400 validation-error (RFC 9457)
    // Zod throws when .parse() fails in controllers/schemas — must map to contract §3
    if (err instanceof zod_1.ZodError) {
        res.setHeader('Content-Type', 'application/problem+json');
        const errors = err.issues.map((issue) => ({
            detail: issue.message,
            pointer: `/${issue.path.join('/')}`,
        }));
        return res.status(400).json({
            type: 'https://api.maame.app/problems/validation-error',
            title: 'Validation error',
            status: 400,
            detail: errors.length === 1 ? errors[0].detail : `${errors.length} validation errors`,
            instance: req.originalUrl,
            errors,
        });
    }
    // Handle standard express JSON parsing errors
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        res.setHeader('Content-Type', 'application/problem+json');
        return res.status(400).json({
            type: 'https://api.maame.app/problems/validation-error',
            title: 'Validation error',
            status: 400,
            detail: 'Invalid JSON payload',
            instance: req.originalUrl,
        });
    }
    // Unhandled error -> 500 Internal Server Error
    // Log server-side with request ID
    console.error(`[Error] Request ID: ${req.requestId} | Error:`, err);
    res.setHeader('Content-Type', 'application/problem+json');
    return res.status(500).json({
        type: 'https://api.maame.app/problems/internal-error',
        title: 'Internal error',
        status: 500,
        detail: 'An internal server error occurred.',
        instance: req.requestId, // "instance set to a request id the engineer can grep for" per contract §10
    });
}
