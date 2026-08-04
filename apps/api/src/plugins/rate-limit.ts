import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { TooManyRequestsError } from '../errors/app-error';

async function rateLimitPlugin(fastify: FastifyInstance) {
  const windowMs = 60 * 1000; // 1 minute window
  const limit = 300; // max 300 requests per minute per IP for simulator readiness
  const hits = new Map<string, { count: number; resetTime: number }>();

  // Periodically sweep expired clients to prevent memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, info] of hits.entries()) {
      if (now > info.resetTime) {
        hits.delete(ip);
      }
    }
  }, 60 * 1000);

  // Stop interval on Fastify shutdown to prevent hanging processes in tests
  fastify.addHook('onClose', async () => {
    clearInterval(interval);
  });

  fastify.addHook('preHandler', async (request) => {
    if (process.env.NODE_ENV === 'test' || request.url.startsWith('/documentation') || request.url.startsWith('/health')) {
      return;
    }

    const ip = request.ip || 'unknown';
    const now = Date.now();
    const info = hits.get(ip);

    if (!info || now > info.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + windowMs });
      return;
    }

    if (info.count >= limit) {
      throw new TooManyRequestsError('Rate limit exceeded. Please try again later.');
    }

    info.count += 1;
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit-plugin',
});
