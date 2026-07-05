import rateLimit from 'express-rate-limit';
import { RateLimitedError } from '../errors/index.js';

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: true, // Emit X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (contract §2)
  handler: (req, res, next) => {
    next(new RateLimitedError('Webhook rate limit exceeded.'));
  },
});

export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: true, // Emit X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (contract §2)
  keyGenerator: (req) => {
    // Rate limit per authenticated user (user is set by authMiddleware before this runs)
    const user = (req as Express.Request & { user?: { id: string } }).user;
    return user?.id || req.ip || 'unknown';
  },
  handler: (req, res, next) => {
    next(new RateLimitedError('Rate limit exceeded.'));
  },
});
export default adminRateLimiter;

