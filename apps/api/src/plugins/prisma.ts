import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  try {
    if (process.env.NODE_ENV !== 'test') {
      await prisma.$connect();
    }
  } catch (err: any) {
    fastify.log.error(err, 'Database connection failed at startup');
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    try {
      if (process.env.NODE_ENV !== 'test') {
        await server.prisma.$disconnect();
      }
    } catch (err) {
      // Ignore disconnect errors on close
    }
  });
};

export default fp(prismaPlugin);
