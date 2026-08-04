import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { CriticRepository } from './critic.repository';
import { CriticService } from './critic.service';
import { CriticEvaluateSchema } from './critic.dto';
import { RetrievalRepository } from '../retrieval/retrieval.repository';
import { MemoryRetriever } from '../retrieval/memory-retriever';
import { BadRequestError } from '../../errors/app-error';

export async function criticRoutes(fastify: FastifyInstance) {
  // Protect all critic routes before validation
  fastify.addHook('preValidation', authenticate);

  const repository = new CriticRepository(fastify.prisma);
  const retrievalRepository = new RetrievalRepository(fastify.prisma);
  const retriever = new MemoryRetriever(retrievalRepository);
  const service = new CriticService(repository, fastify.prisma, retriever);

  // POST /api/v1/critic/evaluate
  fastify.post(
    '/evaluate',
    {
      schema: {
        description: 'Perform LLM Critic evaluation on a historical memory episode',
        tags: ['Critic'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['episodeId'],
          properties: {
            episodeId: { type: 'string', format: 'uuid' },
            provider: { type: 'string', enum: ['mock', 'openai', 'ollama'], default: 'mock' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              evaluation: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  episodeId: { type: 'string' },
                  verdict: { type: 'string' },
                  confidence: { type: 'number' },
                  explanation: { type: 'string' },
                  strengths: { type: 'array', items: { type: 'string' } },
                  weaknesses: { type: 'array', items: { type: 'string' } },
                  suggestedRuleChanges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ruleId: { type: 'string', nullable: true },
                        ruleName: { type: 'string', nullable: true },
                        action: { type: 'string' },
                        reason: { type: 'string' },
                        suggestedProperties: {
                          type: 'object',
                          additionalProperties: true,
                          nullable: true,
                        },
                      },
                    },
                  },
                  rawPrompt: { type: 'string' },
                  rawResponse: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = CriticEvaluateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('Invalid input parameter', parsed.error.format());
      }

      const evaluation = await service.evaluateEpisode(
        request.user.id,
        parsed.data.episodeId,
        parsed.data.provider
      );

      return reply.status(201).send({
        success: true,
        evaluation,
      });
    }
  );

  // GET /api/v1/critic/history
  fastify.get(
    '/history',
    {
      schema: {
        description: 'Get paginated history of critic reports',
        tags: ['Critic'],
        security: [{ BearerAuth: [] }],
        query: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
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
                    episodeId: { type: 'string' },
                    verdict: { type: 'string' },
                    confidence: { type: 'number' },
                    explanation: { type: 'string' },
                    strengths: { type: 'array', items: { type: 'string' } },
                    weaknesses: { type: 'array', items: { type: 'string' } },
                    suggestedRuleChanges: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          ruleName: { type: 'string', nullable: true },
                          action: { type: 'string' },
                          reason: { type: 'string' },
                        },
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
      const page = parseInt((request.query as any).page || '1', 10);
      const limit = parseInt((request.query as any).limit || '10', 10);

      const results = await service.getEvaluationHistory(request.user.id, page, limit);

      return reply.status(200).send({
        success: true,
        ...results,
      });
    }
  );

  // GET /api/v1/critic/:id
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get details of a specific critic evaluation by ID',
        tags: ['Critic'],
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
              evaluation: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  episodeId: { type: 'string' },
                  verdict: { type: 'string' },
                  confidence: { type: 'number' },
                  explanation: { type: 'string' },
                  strengths: { type: 'array', items: { type: 'string' } },
                  weaknesses: { type: 'array', items: { type: 'string' } },
                  suggestedRuleChanges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ruleName: { type: 'string', nullable: true },
                        action: { type: 'string' },
                        reason: { type: 'string' },
                      },
                    },
                  },
                  rawPrompt: { type: 'string' },
                  rawResponse: { type: 'string' },
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
      const evaluation = await service.getEvaluationById(id, request.user.id);

      return reply.status(200).send({
        success: true,
        evaluation,
      });
    }
  );
}
