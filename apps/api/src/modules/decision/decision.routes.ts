import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { DecisionRepository } from './decision.repository';
import { DecisionService } from './decision.service';
import { EvaluateDecisionSchema, DecisionHistoryQuerySchema } from './decision.dto';
import { BadRequestError } from '../../errors/app-error';

export async function decisionRoutes(fastify: FastifyInstance) {
  // Protect all decision routes before schema validation
  fastify.addHook('preValidation', authenticate);

  const repository = new DecisionRepository(fastify.prisma);
  const service = new DecisionService(repository);

  // POST /api/v1/decision/evaluate
  fastify.post(
    '/evaluate',
    {
      schema: {
        description: 'Evaluate an event against active rules and user context to make a delivery decision',
        tags: ['Decision'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              decision: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventId: { type: 'string' },
                  contextSnapshotId: { type: 'string', nullable: true },
                  decision: { type: 'string' },
                  reason: { type: 'string' },
                  confidence: { type: 'number' },
                  signalsUsed: { type: 'array', items: { type: 'string' } },
                  explanation: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      narrative: { type: 'string' },
                      rulesAttribution: { type: 'number' },
                      semanticsAttribution: { type: 'number' },
                      mlAttribution: { type: 'number' },
                      historyAttribution: { type: 'number' },
                    },
                  },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = EvaluateDecisionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const decision = await service.evaluateDecision(request.user.id, bodyParsed.data.eventId);
      return reply.status(201).send({
        success: true,
        decision,
      });
    }
  );

  // GET /api/v1/decision/history
  fastify.get(
    '/history',
    {
      schema: {
        description: 'Get paginated decision history for the authenticated user',
        tags: ['Decision'],
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
                    eventId: { type: 'string' },
                    contextSnapshotId: { type: 'string', nullable: true },
                    decision: { type: 'string' },
                    reason: { type: 'string' },
                    confidence: { type: 'number' },
                    signalsUsed: { type: 'array', items: { type: 'string' } },
                    explanation: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        narrative: { type: 'string' },
                        rulesAttribution: { type: 'number' },
                        semanticsAttribution: { type: 'number' },
                        mlAttribution: { type: 'number' },
                        historyAttribution: { type: 'number' },
                      },
                    },
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
      const queryParsed = DecisionHistoryQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new BadRequestError('Invalid query parameters', queryParsed.error.format());
      }

      const { page, limit } = queryParsed.data;
      const history = await service.getDecisionHistory(request.user.id, page, limit);

      return reply.status(200).send({
        success: true,
        ...history,
      });
    }
  );

  // GET /api/v1/decision/:id
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get decision details by ID',
        tags: ['Decision'],
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
              decision: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventId: { type: 'string' },
                  contextSnapshotId: { type: 'string', nullable: true },
                  decision: { type: 'string' },
                  reason: { type: 'string' },
                  confidence: { type: 'number' },
                  signalsUsed: { type: 'array', items: { type: 'string' } },
                  explanation: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      narrative: { type: 'string' },
                      rulesAttribution: { type: 'number' },
                      semanticsAttribution: { type: 'number' },
                      mlAttribution: { type: 'number' },
                      historyAttribution: { type: 'number' },
                    },
                  },
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
      const decision = await service.getDecisionById(id, request.user.id);
      return reply.status(200).send({
        success: true,
        decision,
      });
    }
  );
}
