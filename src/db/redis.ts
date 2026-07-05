import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let redisClient: Redis | null = null;
let isRedisConnected = false;

if (env.REDIS_URL) {
  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis connected successfully');
      isRedisConnected = true;
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis error/disconnection:', err.message);
      isRedisConnected = false;
    });

    redisClient.connect().catch((err) => {
      console.warn('⚠️ Redis connection failed on startup, falling back to in-memory store:', err.message);
      isRedisConnected = false;
    });
  } catch (err) {
    console.warn('⚠️ Failed to initialize Redis client, falling back to in-memory store:', err);
  }
} else {
  console.log('ℹ️ No REDIS_URL configured, using in-memory store');
}

export const redis = redisClient;
export function isRedisAvailable(): boolean {
  return isRedisConnected && redisClient !== null;
}
