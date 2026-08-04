import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class CacheService {
  private redis: Redis | null = null;
  private fallbackCache: Map<string, { value: string; expiresAt: number }> = new Map();
  private isRedisHealthy = false;

  constructor() {
    // Only connect if not in test env or if explicitly configured
    if (env.NODE_ENV !== 'test') {
      this.connectRedis();
    }
  }

  private connectRedis() {
    try {
      this.redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        reconnectOnError: () => true,
      });

      this.redis.on('connect', () => {
        this.isRedisHealthy = true;
        logger.info({ redisUrl: env.REDIS_URL }, '🔌 Distributed Redis cache connected successfully');
      });

      this.redis.on('error', (err) => {
        this.isRedisHealthy = false;
        logger.warn({ error: err.message }, '⚠️ Redis client disconnected or unavailable. Graceful fallback active.');
      });
    } catch (err: any) {
      this.isRedisHealthy = false;
      logger.warn({ error: err.message }, '⚠️ Failed to initialize Redis client. Graceful fallback active.');
    }
  }

  // Gracefully close connection to prevent Vitest from hanging
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = process.hrtime();
    try {
      if (this.isRedisHealthy && this.redis) {
        const val = await this.redis.get(key);
        const duration = this.getDurationMs(startTime);

        if (val) {
          logger.debug({ key, hit: true, latency: `${duration}ms` }, '⚡ Cache Hit (Redis)');
          return JSON.parse(val) as T;
        }
        logger.debug({ key, hit: false, latency: `${duration}ms` }, '⚡ Cache Miss (Redis)');
        return null;
      }
    } catch (err: any) {
      logger.warn({ key, error: err.message }, '⚠️ Redis GET failed. Falling back to local cache.');
    }

    // Fallback to local memory cache
    const cached = this.fallbackCache.get(key);
    const duration = this.getDurationMs(startTime);

    if (cached) {
      if (Date.now() > cached.expiresAt) {
        this.fallbackCache.delete(key);
        logger.debug({ key, hit: false, latency: `${duration}ms` }, '⚡ Cache Miss (Local Expired)');
        return null;
      }
      logger.debug({ key, hit: true, latency: `${duration}ms` }, '⚡ Cache Hit (Local)');
      return JSON.parse(cached.value) as T;
    }
    logger.debug({ key, hit: false, latency: `${duration}ms` }, '⚡ Cache Miss (Local)');
    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    try {
      if (this.isRedisHealthy && this.redis) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      }
    } catch (err: any) {
      logger.warn({ key, error: err.message }, '⚠️ Redis SET failed. Falling back to local cache.');
    }

    // Fallback to local memory cache
    this.fallbackCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.isRedisHealthy && this.redis) {
        await this.redis.del(key);
        return;
      }
    } catch (err: any) {
      logger.warn({ key, error: err.message }, '⚠️ Redis DEL failed. Falling back to local cache.');
    }

    this.fallbackCache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.isRedisHealthy && this.redis) {
        const res = await this.redis.exists(key);
        return res === 1;
      }
    } catch (err: any) {
      logger.warn({ key, error: err.message }, '⚠️ Redis EXISTS failed. Falling back.');
    }

    const cached = this.fallbackCache.get(key);
    if (cached) {
      if (Date.now() > cached.expiresAt) {
        this.fallbackCache.delete(key);
        return false;
      }
      return true;
    }
    return false;
  }

  async ttl(key: string): Promise<number> {
    try {
      if (this.isRedisHealthy && this.redis) {
        return await this.redis.ttl(key);
      }
    } catch (err: any) {
      logger.warn({ key, error: err.message }, '⚠️ Redis TTL failed.');
    }

    const cached = this.fallbackCache.get(key);
    if (cached) {
      const remainingMs = cached.expiresAt - Date.now();
      return Math.max(0, Math.round(remainingMs / 1000));
    }
    return -2; // Redis standard for key does not exist
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      if (this.isRedisHealthy && this.redis) {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      }
    } catch (err: any) {
      logger.warn({ prefix, error: err.message }, '⚠️ Redis invalidateByPrefix failed. Falling back.');
    }

    for (const key of this.fallbackCache.keys()) {
      if (key.startsWith(prefix)) {
        this.fallbackCache.delete(key);
      }
    }
  }

  private getDurationMs(startTime: [number, number]): string {
    const diff = process.hrtime(startTime);
    const duration = (diff[0] * 1e9 + diff[1]) / 1e6;
    return duration.toFixed(2);
  }
}

export const cacheService = new CacheService();
