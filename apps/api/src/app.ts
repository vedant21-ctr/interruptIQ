import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import prismaPlugin from './plugins/prisma';
import observabilityPlugin from './plugins/observability';
import rateLimitPlugin from './plugins/rate-limit';
import { errorHandler } from './errors/global-handler';
import { env } from './config/env';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { workspaceRoutes } from './modules/workspace/workspace.routes';
import { contextRoutes } from './modules/context/context.routes';
import { eventsRoutes } from './modules/events/events.routes';
import { decisionRoutes } from './modules/decision/decision.routes';
import { feedbackRoutes } from './modules/feedback/feedback.routes';
import { memoryRoutes } from './modules/memory/memory.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { criticRoutes } from './modules/critic/critic.routes';

export function buildApp(): FastifyInstance {
  const loggerConfig = {
    development: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true,
        },
      },
      level: 'debug',
    },
    production: true,
    test: false,
  };

  const currentEnv =
    env.NODE_ENV === 'test' ? 'test' : env.NODE_ENV === 'production' ? 'production' : 'development';

  const app = Fastify({
    logger: loggerConfig[currentEnv],
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Observability & Request Tracing
  app.register(observabilityPlugin);

  // Rate Limiting
  app.register(rateLimitPlugin);

  // Security & Utility Plugins
  app.register(cors, {
    origin: env.NODE_ENV === 'production' ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false) : true,
  });
  app.register(helmet, { contentSecurityPolicy: false }); // Disable CSP for Swagger UI compatibility

  // Database Connection
  app.register(prismaPlugin);

  // Swagger Documentation Setup
  app.register(swagger, {
    swagger: {
      info: {
        title: 'InterruptIQ API',
        description: 'Context Intelligence Platform API Specification',
        version: '1.0.0',
      },
      host: `localhost:${env.PORT}`,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        BearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Type Bearer followed by a space and the JWT token',
        },
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Health and Readiness Checks
  app.get('/health', async (request, reply) => {
    try {
      await app.prisma.$executeRaw`SELECT 1`;
      return { status: 'healthy', db: 'connected', timestamp: new Date().toISOString() };
    } catch (err: any) {
      request.log.error(err, 'Database health check failed');
      return reply
        .status(500)
        .send({ status: 'unhealthy', db: 'disconnected', error: err.message });
    }
  });

  app.get('/ready', async (request, reply) => {
    try {
      await app.prisma.$executeRaw`SELECT 1`;
      return reply.status(200).send({ status: 'ready' });
    } catch (err) {
      return reply.status(503).send({ status: 'not-ready' });
    }
  });

  app.get('/live', async () => {
    return { status: 'live' };
  });

  // Register API Module Routes
  app.register(
    async (api) => {
      api.register(authRoutes, { prefix: '/auth' });
      api.register(usersRoutes, { prefix: '/users' });
      api.register(workspaceRoutes, { prefix: '/workspaces' });
      api.register(contextRoutes, { prefix: '/context' });
      api.register(eventsRoutes, { prefix: '/events' });
      api.register(decisionRoutes, { prefix: '/decision' });
      api.register(feedbackRoutes, { prefix: '/feedback' });
      api.register(memoryRoutes, { prefix: '/memory' });
      api.register(analyticsRoutes, { prefix: '/analytics' });
      api.register(criticRoutes, { prefix: '/critic' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
