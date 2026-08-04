import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { EventRepository } from './events.repository';
import { EventService } from './events.service';
import { CreateEventSchema, EventQuerySchema } from './events.dto';
import { BadRequestError } from '../../errors/app-error';

export async function eventsRoutes(fastify: FastifyInstance) {
  // Protect all event routes before schema validation
  fastify.addHook('preValidation', authenticate);

  const repository = new EventRepository(fastify.prisma);
  const service = new EventService(repository);

  // POST /api/v1/events
  fastify.post(
    '/',
    {
      schema: {
        description: 'Ingest a new incoming event',
        tags: ['Events'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['source', 'sender', 'title', 'body', 'category'],
          properties: {
            source: { type: 'string' },
            sender: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            category: { type: 'string', enum: ['social', 'development', 'system', 'urgent'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
            status: { type: 'string', enum: ['pending', 'processed', 'ignored'], default: 'pending' },
            payload: { type: 'object', additionalProperties: true, nullable: true },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  source: { type: 'string' },
                  sender: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  status: { type: 'string' },
                  payload: { type: 'object', additionalProperties: true, nullable: true },
                  metadata: { type: 'object', additionalProperties: true, nullable: true },
                  timestamp: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = CreateEventSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const event = await service.createEvent(request.user.id, bodyParsed.data);
      return reply.status(201).send({
        success: true,
        event,
      });
    }
  );

  // GET /api/v1/events
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get paginated events history with filtering and searching parameters',
        tags: ['Events'],
        security: [{ BearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' },
            title: { type: 'string' },
            sender: { type: 'string' },
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
                    source: { type: 'string' },
                    sender: { type: 'string' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                    category: { type: 'string' },
                    priority: { type: 'string' },
                    status: { type: 'string' },
                    payload: { type: 'object', additionalProperties: true, nullable: true },
                    metadata: { type: 'object', additionalProperties: true, nullable: true },
                    timestamp: { type: 'string' },
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
      const queryParsed = EventQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new BadRequestError('Invalid query parameters', queryParsed.error.format());
      }

      const history = await service.listEvents(request.user.id, queryParsed.data);
      return reply.status(200).send({
        success: true,
        ...history,
      });
    }
  );

  // GET /api/v1/events/:id
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get details of an ingestion event by ID',
        tags: ['Events'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  source: { type: 'string' },
                  sender: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  status: { type: 'string' },
                  payload: { type: 'object', additionalProperties: true, nullable: true },
                  metadata: { type: 'object', additionalProperties: true, nullable: true },
                  timestamp: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const event = await service.getEventById(id, request.user.id);
      return reply.status(200).send({
        success: true,
        event,
      });
    }
  );

  // DELETE /api/v1/events/:id
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete an event by ID',
        tags: ['Events'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await service.deleteEvent(id, request.user.id);
      return reply.status(200).send({
        success: true,
        message: 'Event deleted successfully',
      });
    }
  );
}
