import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { redis, isRedisAvailable } from '../db/redis.js';
import { ValidationError, IdempotencyConflictError } from '../errors/index.js';

interface CachedResponse {
  requestBody: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// In-memory fallback map for environments without Redis
const memoryCache = new Map<string, CachedResponse>();

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only enforce on mutating admin endpoints (POST, PATCH) as per contract
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return next(new ValidationError('Idempotency-Key header is required for mutating requests'));
  }

  if (typeof idempotencyKey !== 'string') {
    return next(new ValidationError('Idempotency-Key header must be a string'));
  }

  // Validate UUID v4
  const uuidSchema = z.string().uuid();
  const uuidParse = uuidSchema.safeParse(idempotencyKey);
  if (!uuidParse.success) {
    return next(new ValidationError('Idempotency-Key header must be a valid UUID v4'));
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const incomingBodyStr = JSON.stringify(req.body);

  try {
    let cached: CachedResponse | null = null;

    if (isRedisAvailable() && redis) {
      const data = await redis.get(cacheKey);
      if (data) {
        cached = JSON.parse(data);
      }
    } else {
      cached = memoryCache.get(idempotencyKey) || null;
    }

    if (cached) {
      // If key is reused with a different body, it's a conflict
      if (cached.requestBody !== incomingBodyStr) {
        return next(new IdempotencyConflictError());
      }

      // Replay the cached response
      res.status(cached.statusCode);
      Object.entries(cached.headers).forEach(([name, val]) => {
        res.setHeader(name, val);
      });
      res.setHeader('X-Cache-Lookup', 'HIT - Idempotent');
      return res.send(cached.body);
    }
  } catch (err) {
    console.error('Error fetching from idempotency cache:', err);
  }

  // Intercept response to cache it on successful/client-error response
  const originalSend = res.send;
  res.send = function (body): Response {
    if (res.statusCode < 500) {
      const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
      
      const headersToCache: Record<string, string> = {};
      const headers = res.getHeaders();
      Object.entries(headers).forEach(([name, val]) => {
        if (val !== undefined && typeof val === 'string') {
          headersToCache[name] = val;
        }
      });

      const responseToCache: CachedResponse = {
        requestBody: incomingBodyStr,
        statusCode: res.statusCode,
        headers: headersToCache,
        body: responseBody,
      };

      if (isRedisAvailable() && redis) {
        // Store in Redis with 24 hours TTL (86400 seconds)
        redis.set(cacheKey, JSON.stringify(responseToCache), 'EX', 86400).catch((err) => {
          console.error('Error writing to Redis idempotency cache:', err);
        });
      } else {
        memoryCache.set(idempotencyKey, responseToCache);
        // Evict from memory after 24h
        setTimeout(() => {
          memoryCache.delete(idempotencyKey);
        }, 86400 * 1000);
      }
    }

    return originalSend.call(this, body);
  };

  next();
}
