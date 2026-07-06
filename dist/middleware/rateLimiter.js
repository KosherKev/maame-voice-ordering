"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRateLimiter = exports.webhookRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("../errors/index.js");
exports.webhookRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders: true, // Emit X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (contract §2)
    handler: (req, res, next) => {
        next(new index_js_1.RateLimitedError('Webhook rate limit exceeded.'));
    },
});
exports.adminRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: true, // Emit X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (contract §2)
    keyGenerator: (req) => {
        // Rate limit per authenticated user (user is set by authMiddleware before this runs)
        const user = req.user;
        return user?.id || req.ip || 'unknown';
    },
    handler: (req, res, next) => {
        next(new index_js_1.RateLimitedError('Rate limit exceeded.'));
    },
});
exports.default = exports.adminRateLimiter;
