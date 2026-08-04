import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { ContextRepository } from './context.repository';
import { ContextService } from './context.service';
import { PatchContextSnapshotSchema, ContextHistoryQuerySchema } from './context.dto';
import { BadRequestError } from '../../errors/app-error';

export async function contextRoutes(fastify: FastifyInstance) {
  // Protect all context routes before schema validation
  fastify.addHook('preValidation', authenticate);

  const repository = new ContextRepository(fastify.prisma);
  const service = new ContextService(repository);

  // GET /api/v1/context/current
  fastify.get(
    '/current',
    {
      schema: {
        description: 'Get the latest context snapshot for the authenticated user',
        tags: ['Context'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              context: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  battery: { type: 'integer' },
                  charging: { type: 'boolean' },
                  activity: { type: 'string' },
                  timeOfDay: { type: 'string' },
                  visibility: { type: 'string' },
                  network: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  motion: { type: 'string', nullable: true },
                  heartRate: { type: 'integer', nullable: true },
                  currentTask: { type: 'string', nullable: true },
                  focusLevel: { type: 'integer', nullable: true },
                  calendarStatus: { type: 'string', nullable: true },
                  workingMode: { type: 'string', nullable: true },
                  deviceStatus: { type: 'string', nullable: true },
                  manualNotes: { type: 'string', nullable: true },
                  metadata: { type: 'object', additionalProperties: true, nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const context = await service.getCurrentContext(request.user.id);
      return reply.status(200).send({
        success: true,
        context,
      });
    }
  );

  // PATCH /api/v1/context/current
  fastify.patch(
    '/current',
    {
      schema: {
        description: 'Create a new context snapshot merging updates with the latest context snapshot',
        tags: ['Context'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            battery: { type: 'integer', minimum: 0, maximum: 100 },
            charging: { type: 'boolean' },
            activity: { type: 'string' },
            timeOfDay: { type: 'string' },
            visibility: { type: 'string' },
            network: { type: 'string' },
            location: { type: 'string', nullable: true },
            motion: { type: 'string', nullable: true },
            heartRate: { type: 'integer', nullable: true },
            currentTask: { type: 'string', nullable: true },
            focusLevel: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
            calendarStatus: { type: 'string', nullable: true },
            workingMode: { type: 'string', nullable: true },
            deviceStatus: { type: 'string', nullable: true },
            manualNotes: { type: 'string', nullable: true },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              context: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  battery: { type: 'integer' },
                  charging: { type: 'boolean' },
                  activity: { type: 'string' },
                  timeOfDay: { type: 'string' },
                  visibility: { type: 'string' },
                  network: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  motion: { type: 'string', nullable: true },
                  heartRate: { type: 'integer', nullable: true },
                  currentTask: { type: 'string', nullable: true },
                  focusLevel: { type: 'integer', nullable: true },
                  calendarStatus: { type: 'string', nullable: true },
                  workingMode: { type: 'string', nullable: true },
                  deviceStatus: { type: 'string', nullable: true },
                  manualNotes: { type: 'string', nullable: true },
                  metadata: { type: 'object', additionalProperties: true, nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = PatchContextSnapshotSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const context = await service.patchContext(request.user.id, bodyParsed.data);
      return reply.status(200).send({
        success: true,
        context,
      });
    }
  );

  // GET /api/v1/context/history
  fastify.get(
    '/history',
    {
      schema: {
        description: 'Get paginated context history for the authenticated user',
        tags: ['Context'],
        security: [{ BearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    battery: { type: 'integer' },
                    charging: { type: 'boolean' },
                    activity: { type: 'string' },
                    timeOfDay: { type: 'string' },
                    visibility: { type: 'string' },
                    network: { type: 'string' },
                    location: { type: 'string', nullable: true },
                    motion: { type: 'string', nullable: true },
                    heartRate: { type: 'integer', nullable: true },
                    currentTask: { type: 'string', nullable: true },
                    focusLevel: { type: 'integer', nullable: true },
                    calendarStatus: { type: 'string', nullable: true },
                    workingMode: { type: 'string', nullable: true },
                    deviceStatus: { type: 'string', nullable: true },
                    manualNotes: { type: 'string', nullable: true },
                    metadata: { type: 'object', additionalProperties: true, nullable: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const queryParsed = ContextHistoryQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new BadRequestError('Invalid query parameters', queryParsed.error.format());
      }

      const { page, limit } = queryParsed.data;
      const history = await service.getContextHistory(request.user.id, page, limit);
      
      return reply.status(200).send({
        success: true,
        ...history,
      });
    }
  );

  // DELETE /api/v1/context/current
  fastify.delete(
    '/current',
    {
      schema: {
        description: 'Delete the latest context snapshot for the authenticated user',
        tags: ['Context'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              context: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  battery: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const deleted = await service.deleteCurrentContext(request.user.id);
      return reply.status(200).send({
        success: true,
        message: 'Current context snapshot deleted successfully',
        context: {
          id: deleted.id,
          userId: deleted.userId,
          battery: deleted.battery,
        },
      });
    }
  );
}
