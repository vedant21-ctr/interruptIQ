import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    startTime: [number, number];
  }
}

async function observabilityPlugin(fastify: FastifyInstance) {
  // Store start time on request entry
  fastify.addHook('onRequest', async (request) => {
    request.startTime = process.hrtime();
  });

  // Calculate and log latency on response completion
  fastify.addHook('onResponse', async (request, reply) => {
    const diff = process.hrtime(request.startTime);
    const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
    
    reply.header('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    
    request.log.info({
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      latency: `${durationMs.toFixed(2)}ms`,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
    }, `HTTP ${request.method} ${request.url} - ${reply.statusCode} (${durationMs.toFixed(2)}ms)`);
  });
}

export default fp(observabilityPlugin, {
  name: 'observability-plugin',
});
