import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';
import { cacheService } from '../src/services/cache.service';
import {
  BoundedMemoryStore,
  resolveRoutePolicy,
  normalizeIp,
  generateClientKey,
  memoryStore,
  RATE_LIMIT_LUA_SCRIPT,
} from '../src/plugins/rate-limit';

describe('API Rate Limiting & Abuse Protection', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    memoryStore.reset();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==========================================
  // UNIT TESTS: Helpers, Keys & Bounded Memory
  // ==========================================

  describe('IP Normalization & Key Generation', () => {
    it('should normalize IPv4-mapped IPv6 and localhost representations', () => {
      expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('::1')).toBe('127.0.0.1');
      expect(normalizeIp(' 10.0.0.1 ')).toBe('10.0.0.1');
      expect(normalizeIp(undefined)).toBe('unknown');
    });

    it('should generate anonymous IP key when unauthenticated', () => {
      const req: any = { ip: '192.168.1.50' };
      const key = generateClientKey(req, 'auth');
      expect(key).toBe('rl:ip:192.168.1.50:auth');
    });

    it('should generate authenticated user key when request.user is set', () => {
      const req: any = {
        ip: '192.168.1.50',
        user: { id: 'usr_abc123', email: 'user@example.com', name: 'User' },
      };
      const key = generateClientKey(req, 'events');
      expect(key).toBe('rl:user:usr_abc123:events');
    });

    it('should not allow unauthenticated request with empty user object to claim user key', () => {
      const req: any = { ip: '10.0.0.5', user: { id: '   ' } };
      const key = generateClientKey(req, 'decision');
      expect(key).toBe('rl:ip:10.0.0.5:decision');
    });
  });

  describe('Route Policy Resolver', () => {
    const defaultLimits = {
      globalMax: 100,
      globalWindowMs: 60000,
      authMax: 10,
      eventsMax: 120,
      decisionMax: 60,
      retrievalMax: 20,
      criticMax: 10,
    };

    it('should classify probe and documentation routes as exempt', () => {
      expect(resolveRoutePolicy('GET', '/health', defaultLimits).isExempt).toBe(true);
      expect(resolveRoutePolicy('GET', '/ready', defaultLimits).isExempt).toBe(true);
      expect(resolveRoutePolicy('GET', '/live', defaultLimits).isExempt).toBe(true);
      expect(
        resolveRoutePolicy('GET', '/documentation/static/index.html', defaultLimits).isExempt
      ).toBe(true);
    });

    it('should resolve auth endpoints to auth policy', () => {
      const policy = resolveRoutePolicy('POST', '/api/v1/auth/login', defaultLimits);
      expect(policy.group).toBe('auth');
      expect(policy.max).toBe(10);
      expect(policy.isExempt).toBe(false);
    });

    it('should resolve events endpoints to events policy', () => {
      const policy = resolveRoutePolicy('POST', '/api/v1/events', defaultLimits);
      expect(policy.group).toBe('events');
      expect(policy.max).toBe(120);
    });

    it('should resolve decision endpoints to decision policy (singular /decision)', () => {
      const policy = resolveRoutePolicy('POST', '/api/v1/decision/evaluate', defaultLimits);
      expect(policy.group).toBe('decision');
      expect(policy.max).toBe(60);
    });

    it('should resolve retrieval endpoints to retrieval policy', () => {
      const retrievePolicy = resolveRoutePolicy('POST', '/api/v1/memory/retrieve', defaultLimits);
      expect(retrievePolicy.group).toBe('retrieval');
      expect(retrievePolicy.max).toBe(20);

      const embedPolicy = resolveRoutePolicy('POST', '/api/v1/memory/embed', defaultLimits);
      expect(embedPolicy.group).toBe('retrieval');
      expect(embedPolicy.max).toBe(20);
    });

    it('should resolve critic endpoints to critic policy', () => {
      const policy = resolveRoutePolicy('POST', '/api/v1/critic/evaluate', defaultLimits);
      expect(policy.group).toBe('critic');
      expect(policy.max).toBe(10);
    });

    it('should resolve general API routes to global policy', () => {
      const policy = resolveRoutePolicy('GET', '/api/v1/users/me', defaultLimits);
      expect(policy.group).toBe('global');
      expect(policy.max).toBe(100);
    });
  });

  describe('BoundedMemoryStore', () => {
    it('should enforce limits and track TTL correctly', () => {
      const store = new BoundedMemoryStore(100, 60000);
      const res1 = store.increment('test-key', 5000);
      expect(res1.count).toBe(1);
      expect(res1.ttlMs).toBeLessThanOrEqual(5000);

      const res2 = store.increment('test-key', 5000);
      expect(res2.count).toBe(2);

      store.close();
    });

    it('should evict keys when reaching capacity bound', () => {
      const capacity = 3;
      const store = new BoundedMemoryStore(capacity, 60000);

      store.increment('key1', 10000);
      store.increment('key2', 10000);
      store.increment('key3', 10000);
      expect(store.size()).toBe(3);

      // Adding a 4th key triggers bounded eviction
      store.increment('key4', 10000);
      expect(store.size()).toBe(capacity);

      store.close();
    });

    it('should sweep expired keys', () => {
      const store = new BoundedMemoryStore(100, 60000);
      store.increment('short-key', -10); // Expired immediately
      expect(store.size()).toBe(1);

      store.cleanup();
      expect(store.size()).toBe(0);

      store.close();
    });
  });

  // ==========================================
  // INTEGRATION TESTS: HTTP & Policies
  // ==========================================

  describe('HTTP Rate Limiting Integration', () => {
    function setupPrismaMock(fastify: FastifyInstance) {
      fastify.prisma.$executeRaw = async () => 1;
      fastify.prisma.user.findUnique = vi.fn().mockImplementation(async ({ where }: any) => {
        return {
          id: where.id,
          email: `${where.id}@example.com`,
          name: `User ${where.id}`,
          deletedAt: null,
        };
      });
      fastify.prisma.event.create = vi.fn().mockImplementation(async ({ data }: any) => ({
        id: 'event-id-123',
        ...data,
        createdAt: new Date(),
        timestamp: new Date(),
      }));
    }

    it('1. should not enforce limits when RATE_LIMIT_ENABLED is false', async () => {
      app = buildApp({
        rateLimit: {
          enabled: false,
          globalMax: 2,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      for (let i = 0; i < 5; i++) {
        const res = await app.inject({ method: 'GET', url: '/ready' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['ratelimit-limit']).toBeUndefined();
      }
    });

    it('2 & 3. should allow requests below and at limit, and set standard headers', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 2,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      // Request 1: below limit
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/invalid-probe-route',
      });
      expect(res1.statusCode).toBe(404); // Handled by Fastify router, but preHandler ran
      expect(res1.headers['ratelimit-limit']).toBe('2');
      expect(res1.headers['ratelimit-remaining']).toBe('1');
      expect(Number(res1.headers['ratelimit-reset'])).toBeGreaterThanOrEqual(1);

      // Request 2: exactly at limit
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/invalid-probe-route',
      });
      expect(res2.statusCode).toBe(404);
      expect(res2.headers['ratelimit-remaining']).toBe('0');
    });

    it('4 & 18 & 22. should return HTTP 429, Retry-After header, and API error format when limit exceeded', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 2,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      await app.inject({ method: 'GET', url: '/api/v1/invalid-probe-route' });
      await app.inject({ method: 'GET', url: '/api/v1/invalid-probe-route' });

      // Request 3: exceeds limit
      const res3 = await app.inject({
        method: 'GET',
        url: '/api/v1/invalid-probe-route',
      });
      expect(res3.statusCode).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      expect(Number(res3.headers['retry-after'])).toBeGreaterThanOrEqual(1);

      const body = JSON.parse(res3.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('TooManyRequestsError');
      expect(body.message).toContain('Rate limit exceeded');
    });

    it('5. should reset quota after window expires', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 1,
          globalWindowMs: 50, // 50ms test window
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const res1 = await app.inject({ method: 'GET', url: '/api/v1/test-expire' });
      expect(res1.statusCode).toBe(404);

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/test-expire' });
      expect(res2.statusCode).toBe(429);

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60));

      const res3 = await app.inject({ method: 'GET', url: '/api/v1/test-expire' });
      expect(res3.statusCode).toBe(404); // Quota restored
    });

    it('6. should isolate quotas for different client IPs', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const resIp1 = await app.inject({
        method: 'GET',
        url: '/api/v1/test-ip',
        remoteAddress: '10.0.0.1',
      });
      expect(resIp1.statusCode).toBe(404);

      // Second request from IP 1 is blocked
      const resIp1Blocked = await app.inject({
        method: 'GET',
        url: '/api/v1/test-ip',
        remoteAddress: '10.0.0.1',
      });
      expect(resIp1Blocked.statusCode).toBe(429);

      // Request from IP 2 is permitted
      const resIp2 = await app.inject({
        method: 'GET',
        url: '/api/v1/test-ip',
        remoteAddress: '10.0.0.2',
      });
      expect(resIp2.statusCode).toBe(404);
    });

    it('7 & 8. should isolate quotas by authenticated user ID', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const tokenUserA = jwt.sign({ userId: 'user-A', email: 'a@example.com' }, env.JWT_SECRET);
      const tokenUserB = jwt.sign({ userId: 'user-B', email: 'b@example.com' }, env.JWT_SECRET);

      // User A request 1
      const resA1 = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${tokenUserA}` },
      });
      expect(resA1.statusCode).toBe(200);

      // User A request 2 is throttled
      const resA2 = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${tokenUserA}` },
      });
      expect(resA2.statusCode).toBe(429);

      // User B request 1 is permitted
      const resB1 = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${tokenUserB}` },
      });
      expect(resB1.statusCode).toBe(200);
    });

    it('9. should throttle same authenticated user across different IPs under same user quota', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const tokenUser = jwt.sign(
        { userId: 'roaming-user', email: 'roam@example.com' },
        env.JWT_SECRET
      );

      // From IP 1
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${tokenUser}` },
        remoteAddress: '172.16.0.1',
      });
      expect(res1.statusCode).toBe(200);

      // From IP 2 -> throttled because key is user-scoped
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${tokenUser}` },
        remoteAddress: '172.16.0.2',
      });
      expect(res2.statusCode).toBe(429);
    });

    it('10. should apply auth policy to /api/v1/auth endpoints', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          authMax: 2,
          globalMax: 10,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      // /api/v1/auth/logout accepts post
      const res1 = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(res1.statusCode).toBe(200);
      expect(res1.headers['ratelimit-limit']).toBe('2');

      await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });

      // Exceeds auth limit
      const res3 = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(res3.statusCode).toBe(429);
      expect(JSON.parse(res3.body).message).toContain("policy 'auth'");
    });

    it('11. should apply events policy to /api/v1/events endpoints', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          eventsMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const token = jwt.sign(
        { userId: 'events-user', email: 'events@example.com' },
        env.JWT_SECRET
      );

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          source: 'github',
          sender: 'octocat',
          title: 'PR merged',
          body: 'feat: add rate limiting',
          category: 'development',
        },
      });
      expect(res1.statusCode).toBe(201);
      expect(res1.headers['ratelimit-limit']).toBe('1');

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          source: 'github',
          sender: 'octocat',
          title: 'PR merged',
          body: 'feat: add rate limiting',
          category: 'development',
        },
      });
      expect(res2.statusCode).toBe(429);
      expect(JSON.parse(res2.body).message).toContain("policy 'events'");
    });

    it('12. should apply decision policy to /api/v1/decision endpoints', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          decisionMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const token = jwt.sign({ userId: 'decision-user', email: 'dec@example.com' }, env.JWT_SECRET);

      // GET /api/v1/decision/history
      app.prisma.decision.findMany = vi.fn().mockResolvedValue([]) as any;
      app.prisma.decision.count = vi.fn().mockResolvedValue(0) as any;

      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/decision/history',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res1.headers['ratelimit-limit']).toBe('1');

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/decision/history',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res2.statusCode).toBe(429);
      expect(JSON.parse(res2.body).message).toContain("policy 'decision'");
    });

    it('13. should apply retrieval policy to /api/v1/memory/retrieve', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          retrievalMax: 1,
          globalMax: 10,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const token = jwt.sign(
        { userId: 'retrieval-user', email: 'ret@example.com' },
        env.JWT_SECRET
      );

      // Mock retrieval service
      app.prisma.memoryEpisode = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      } as any;

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { authorization: `Bearer ${token}` },
        payload: { keyword: 'test' },
      });
      expect(res1.headers['ratelimit-limit']).toBe('1');

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { authorization: `Bearer ${token}` },
        payload: { keyword: 'test' },
      });
      expect(res2.statusCode).toBe(429);
      expect(JSON.parse(res2.body).message).toContain("policy 'retrieval'");
    });

    it('14. should apply critic policy to /api/v1/critic/evaluate', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          criticMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const token = jwt.sign(
        { userId: 'critic-user', email: 'critic@example.com' },
        env.JWT_SECRET
      );

      app.prisma.memoryEpisode = {
        findFirst: vi.fn().mockResolvedValue({
          id: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'critic-user',
          decisionType: 'NOTIFY NOW',
          explanation: 'test',
          outcome: 'ACCEPTED',
          createdAt: new Date(),
        }),
      } as any;
      app.prisma.criticEvaluation = {
        create: vi.fn().mockResolvedValue({
          id: 'eval-1',
          userId: 'critic-user',
          episodeId: '550e8400-e29b-41d4-a716-446655440000',
          verdict: 'SOUND',
          confidence: 0.9,
          explanation: 'ok',
          strengths: [],
          weaknesses: [],
          suggestedRuleChanges: [],
          rawPrompt: '',
          rawResponse: '',
          createdAt: new Date().toISOString(),
        }),
      } as any;

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          episodeId: '550e8400-e29b-41d4-a716-446655440000',
          provider: 'mock',
        },
      });
      expect(res1.headers['ratelimit-limit']).toBe('1');

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          episodeId: '550e8400-e29b-41d4-a716-446655440000',
          provider: 'mock',
        },
      });
      expect(res2.statusCode).toBe(429);
      expect(JSON.parse(res2.body).message).toContain("policy 'critic'");
    });

    it('16 & 17. should exempt /health, /ready, /live, and /documentation without rate limit headers', async () => {
      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 1,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      for (let i = 0; i < 5; i++) {
        const hRes = await app.inject({ method: 'GET', url: '/health' });
        expect(hRes.statusCode).toBe(200);
        expect(hRes.headers['ratelimit-limit']).toBeUndefined();

        const rRes = await app.inject({ method: 'GET', url: '/ready' });
        expect(rRes.statusCode).toBe(200);

        const lRes = await app.inject({ method: 'GET', url: '/live' });
        expect(lRes.statusCode).toBe(200);

        const docRes = await app.inject({ method: 'GET', url: '/documentation/static/index.html' });
        expect(docRes.statusCode).toBe(200);
      }
    });

    // ==========================================
    // REDIS & RESILIENT FALLBACK TESTS
    // ==========================================

    it('23. should execute Redis Lua script when Redis is healthy', async () => {
      const mockEval = vi.fn().mockResolvedValue([1, 55000]);
      const mockRedis = { eval: mockEval };
      vi.spyOn(cacheService, 'getRedisClient').mockReturnValue(mockRedis as any);

      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 5,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const res = await app.inject({ method: 'GET', url: '/api/v1/test-redis' });
      expect(res.statusCode).toBe(404);
      expect(mockEval).toHaveBeenCalledWith(RATE_LIMIT_LUA_SCRIPT, 1, expect.any(String), '60000');
      expect(res.headers['ratelimit-remaining']).toBe('4');
    });

    it('24 & 25. should gracefully fall back to in-memory limiting when Redis is unavailable', async () => {
      vi.spyOn(cacheService, 'getRedisClient').mockReturnValue(null);

      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 2,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      const res1 = await app.inject({ method: 'GET', url: '/api/v1/mem-fallback' });
      expect(res1.statusCode).toBe(404);
      expect(res1.headers['ratelimit-remaining']).toBe('1');

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/mem-fallback' });
      expect(res2.statusCode).toBe(404);
      expect(res2.headers['ratelimit-remaining']).toBe('0');

      const res3 = await app.inject({ method: 'GET', url: '/api/v1/mem-fallback' });
      expect(res3.statusCode).toBe(429); // In-memory fallback still strictly throttles
    });

    it('26. should fall back to memory without failing request if Redis throws during execution', async () => {
      const mockEval = vi.fn().mockRejectedValue(new Error('Connection timed out'));
      const mockRedis = { eval: mockEval };
      vi.spyOn(cacheService, 'getRedisClient').mockReturnValue(mockRedis as any);

      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 2,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      // Should not throw 500; gracefully catches Redis error and uses in-memory counter
      const res1 = await app.inject({ method: 'GET', url: '/api/v1/redis-fail' });
      expect(res1.statusCode).toBe(404);
      expect(res1.headers['ratelimit-remaining']).toBe('1');

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/redis-fail' });
      expect(res2.statusCode).toBe(404);

      const res3 = await app.inject({ method: 'GET', url: '/api/v1/redis-fail' });
      expect(res3.statusCode).toBe(429);
    });

    it('27. should resume using Redis when Redis client recovers', async () => {
      let redisClient: any = null;
      vi.spyOn(cacheService, 'getRedisClient').mockImplementation(() => redisClient);

      app = buildApp({
        rateLimit: {
          enabled: true,
          globalMax: 5,
        },
      });
      await app.ready();
      setupPrismaMock(app);

      // Step 1: Redis unavailable -> memory store used
      const res1 = await app.inject({ method: 'GET', url: '/api/v1/recovery' });
      expect(res1.statusCode).toBe(404);

      // Step 2: Redis recovers
      const mockEval = vi.fn().mockResolvedValue([1, 60000]);
      redisClient = { eval: mockEval };

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/recovery' });
      expect(res2.statusCode).toBe(404);
      expect(mockEval).toHaveBeenCalled();
    });

    it('29. should cleanly close memoryStore interval on Fastify onClose', async () => {
      app = buildApp({
        rateLimit: { enabled: true },
      });
      await app.ready();

      const closeSpy = vi.spyOn(memoryStore, 'close');
      await app.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
