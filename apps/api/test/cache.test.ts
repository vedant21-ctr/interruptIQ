import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { CacheService } from '../src/services/cache.service';
import Redis from 'ioredis';

describe('Distributed Cache Service Tests', () => {
  let cache: CacheService;

  beforeAll(() => {
    cache = new CacheService();
  });

  afterAll(async () => {
    await cache.disconnect();
  });

  test('Local Fallback: get and set key value pairs', async () => {
    await cache.set('test:local:key', { foo: 'bar' }, 10);
    const exists = await cache.exists('test:local:key');
    expect(exists).toBe(true);

    const val = await cache.get<{ foo: string }>('test:local:key');
    expect(val).toEqual({ foo: 'bar' });
  });

  test('Local Fallback: invalidate key', async () => {
    await cache.set('test:invalidate', 'data', 5);
    await cache.invalidate('test:invalidate');
    const val = await cache.get('test:invalidate');
    expect(val).toBeNull();
  });

  test('Local Fallback: prefix invalidation works correctly', async () => {
    await cache.set('test:prefix:1', 'a', 10);
    await cache.set('test:prefix:2', 'b', 10);
    await cache.set('other:prefix:1', 'c', 10);

    await cache.invalidateByPrefix('test:prefix');

    expect(await cache.get('test:prefix:1')).toBeNull();
    expect(await cache.get('test:prefix:2')).toBeNull();
    expect(await cache.get('other:prefix:1')).toBe('c');
  });

  test('Local Fallback: key expiration via TTL works correctly', async () => {
    await cache.set('test:expire', 'temp', 1);
    const ttl = await cache.ttl('test:expire');
    expect(ttl).toBeGreaterThanOrEqual(0);
    
    // Simulate manual expiration to prevent long sleep delays in tests
    const innerFallback = (cache as any).fallbackCache;
    const item = innerFallback.get('test:expire');
    if (item) {
      item.expiresAt = Date.now() - 1000; // expired
    }

    const val = await cache.get('test:expire');
    expect(val).toBeNull();
  });
});
