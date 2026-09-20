import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env';
import { cacheService } from '../services/cache.service';
import { TooManyRequestsError } from '../errors/app-error';

export interface RateLimitPluginOptions {
  enabled?: boolean;
  globalMax?: number;
  globalWindowMs?: number;
  authMax?: number;
  eventsMax?: number;
  decisionMax?: number;
  retrievalMax?: number;
  criticMax?: number;
  maxMemoryKeys?: number;
}

export type PolicyGroup =
  'exempt' | 'auth' | 'critic' | 'retrieval' | 'decision' | 'events' | 'global';

export interface RoutePolicy {
  group: PolicyGroup;
  max: number;
  windowMs: number;
  isExempt: boolean;
}

export interface PolicyLimits {
  globalMax: number;
  globalWindowMs: number;
  authMax: number;
  eventsMax: number;
  decisionMax: number;
  retrievalMax: number;
  criticMax: number;
}

/**
 * Normalizes IPv4 and IPv6 string representations safely.
 */
export function normalizeIp(rawIp?: string): string {
  if (!rawIp) return 'unknown';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

/**
 * Resolves route policies without hardcoding limits inside route handlers.
 * Matches HTTP method and URL path to specific sensitivity tiers.
 */
export function resolveRoutePolicy(method: string, url: string, limits: PolicyLimits): RoutePolicy {
  const path = url.split('?')[0];

  // Exempt routes: health checks, probes, and Swagger documentation
  if (
    path === '/health' ||
    path.startsWith('/health') ||
    path === '/ready' ||
    path.startsWith('/ready') ||
    path === '/live' ||
    path.startsWith('/live') ||
    path.startsWith('/documentation')
  ) {
    return {
      group: 'exempt',
      max: 0,
      windowMs: limits.globalWindowMs,
      isExempt: true,
    };
  }

  // Auth endpoints (sensitive to brute-force and credential stuffing)
  if (path.startsWith('/api/v1/auth')) {
    return {
      group: 'auth',
      max: limits.authMax,
      windowMs: limits.globalWindowMs,
      isExempt: false,
    };
  }

  // LLM Critic evaluations (extremely expensive computation / external API calls)
  if (path.startsWith('/api/v1/critic')) {
    return {
      group: 'critic',
      max: limits.criticMax,
      windowMs: limits.globalWindowMs,
      isExempt: false,
    };
  }

  // Semantic retrieval and embeddings (expensive vector & database operations)
  if (
    path === '/api/v1/memory/retrieve' ||
    path.startsWith('/api/v1/memory/retrieve') ||
    path === '/api/v1/memory/embed' ||
    path.startsWith('/api/v1/memory/embed') ||
    path === '/api/v1/memory/reindex' ||
    path.startsWith('/api/v1/memory/reindex')
  ) {
    return {
      group: 'retrieval',
      max: limits.retrievalMax,
      windowMs: limits.globalWindowMs,
      isExempt: false,
    };
  }

  // Decision engine evaluations (rules & heuristic pipelines)
  if (path.startsWith('/api/v1/decision')) {
    return {
      group: 'decision',
      max: limits.decisionMax,
      windowMs: limits.globalWindowMs,
      isExempt: false,
    };
  }

  // Events ingestion and history (high-throughput ingest pipeline)
  if (path.startsWith('/api/v1/events')) {
    return {
      group: 'events',
      max: limits.eventsMax,
      windowMs: limits.globalWindowMs,
      isExempt: false,
    };
  }

  // Fallback global policy for other /api routes
  return {
    group: 'global',
    max: limits.globalMax,
    windowMs: limits.globalWindowMs,
    isExempt: false,
  };
}

/**
 * Generates client identification keys.
 * Uses authenticated user ID when available from request.user,
 * otherwise falls back to normalized client IP.
 */
export function generateClientKey(request: FastifyRequest, group: string): string {
  const userId =
    request.user && typeof request.user.id === 'string' && request.user.id.trim().length > 0
      ? request.user.id.trim()
      : null;

  if (userId) {
    return `rl:user:${userId}:${group}`;
  }

  const ip = normalizeIp(request.ip);
  return `rl:ip:${ip}:${group}`;
}

/**
 * Atomic fixed-window rate-limiting Lua script.
 * Safely initializes window expiry on count 1 without resetting active windows.
 */
export const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])

local count = redis.call("INCR", key)
if count == 1 then
    redis.call("PEXPIRE", key, windowMs)
end

local ttl = redis.call("PTTL", key)
if ttl == -1 then
    redis.call("PEXPIRE", key, windowMs)
    ttl = windowMs
end

return { count, ttl }
`;

interface MemoryCounter {
  count: number;
  resetTime: number; // Unix epoch ms
}

/**
 * Bounded in-memory fallback store with active sweep and capacity eviction.
 * Used when Redis is unavailable or disconnected during development.
 *
 * NOTE: In-memory fallback is node-local and therefore not globally distributed
 * across multiple API instances.
 */
export class BoundedMemoryStore {
  private readonly maxKeys: number;
  private readonly store: Map<string, MemoryCounter>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxKeys: number = 10000, cleanupIntervalMs: number = 30000) {
    this.maxKeys = maxKeys;
    this.store = new Map();

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  public increment(key: string, windowMs: number): { count: number; ttlMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      if (this.store.size >= this.maxKeys) {
        this.evictOne();
      }
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, ttlMs: windowMs };
    }

    entry.count += 1;
    const ttlMs = Math.max(0, entry.resetTime - now);
    return { count: entry.count, ttlMs };
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  private evictOne(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
        return;
      }
    }
    const oldestKey = this.store.keys().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  public size(): number {
    return this.store.size;
  }

  public reset(): void {
    this.store.clear();
  }

  public close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

// Global bounded in-memory fallback instance
export const memoryStore = new BoundedMemoryStore();

let lastRedisErrorLog = 0;
const REDIS_ERROR_LOG_THROTTLE_MS = 60000;

async function rateLimitPlugin(fastify: FastifyInstance, opts: RateLimitPluginOptions = {}) {
  const isEnabled = opts.enabled ?? env.RATE_LIMIT_ENABLED;

  const limits: PolicyLimits = {
    globalMax: opts.globalMax ?? env.RATE_LIMIT_GLOBAL_MAX,
    globalWindowMs: opts.globalWindowMs ?? env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    authMax: opts.authMax ?? env.RATE_LIMIT_AUTH_MAX,
    eventsMax: opts.eventsMax ?? env.RATE_LIMIT_EVENTS_MAX,
    decisionMax: opts.decisionMax ?? env.RATE_LIMIT_DECISION_MAX,
    retrievalMax: opts.retrievalMax ?? env.RATE_LIMIT_RETRIEVAL_MAX,
    criticMax: opts.criticMax ?? env.RATE_LIMIT_CRITIC_MAX,
  };

  // Cleanup on Fastify server shutdown to prevent hanging processes
  fastify.addHook('onClose', async () => {
    memoryStore.close();
  });

  // Execute in preHandler hook so authenticate (in preValidation) has already attached request.user
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isEnabled) {
      return;
    }

    const policy = resolveRoutePolicy(request.method, request.url, limits);
    if (policy.isExempt) {
      return;
    }

    const key = generateClientKey(request, policy.group);
    const windowMs = policy.windowMs;
    const limit = policy.max;

    let count = 0;
    let ttlMs = windowMs;

    const redis = cacheService.getRedisClient();

    if (redis) {
      try {
        const result = (await redis.eval(RATE_LIMIT_LUA_SCRIPT, 1, key, windowMs.toString())) as [
          number,
          number,
        ];

        count = Number(result[0]);
        ttlMs = Math.max(0, Number(result[1]));
      } catch (err: any) {
        const now = Date.now();
        if (now - lastRedisErrorLog > REDIS_ERROR_LOG_THROTTLE_MS) {
          lastRedisErrorLog = now;
          fastify.log.warn(
            { error: err.message, key },
            '⚠️ Redis rate-limit command failed. Gracefully falling back to bounded in-memory limiting.'
          );
        }
        // Fall back to in-memory counter if Redis fails
        const memResult = memoryStore.increment(key, windowMs);
        count = memResult.count;
        ttlMs = memResult.ttlMs;
      }
    } else {
      // In-memory fallback during development when Redis is unavailable or unconfigured
      const memResult = memoryStore.increment(key, windowMs);
      count = memResult.count;
      ttlMs = memResult.ttlMs;
    }

    const remaining = Math.max(0, limit - count);
    const resetSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    // Standard rate-limit headers
    reply.header('RateLimit-Limit', limit);
    reply.header('RateLimit-Remaining', remaining);
    reply.header('RateLimit-Reset', resetSeconds);

    // Enforce throttling when limit is exceeded
    if (count > limit) {
      reply.header('Retry-After', resetSeconds);
      const error = new TooManyRequestsError(
        `Rate limit exceeded for policy '${policy.group}'. Please retry after ${resetSeconds} seconds.`
      );
      error.name = 'TooManyRequestsError';
      throw error;
    }
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit-plugin',
  fastify: '4.x',
});
