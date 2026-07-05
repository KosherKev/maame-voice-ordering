import rateLimit from 'express-rate-limit';
import { RateLimitedError } from '../errors/index.js';

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new RateLimitedError('Webhook rate limit exceeded.'));
  },
});

export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (req as any).user;
    return user?.id || req.ip || 'unknown';
  },
  handler: (req, res, next) => {
    next(new RateLimitedError('Rate limit exceeded.'));
  },
});
export default adminRateLimiter;
