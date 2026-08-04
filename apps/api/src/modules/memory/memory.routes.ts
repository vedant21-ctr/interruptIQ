import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { MemoryRepository } from './memory.repository';
import { SearchService } from './search.service';
import { MemoryService } from './memory.service';
import { CreateMemoryEpisodeSchema, MemorySearchSchema } from './memory.dto';
import { BadRequestError } from '../../errors/app-error';
import { MemoryRetrievalSchema } from './retrieval.dto';
import { RetrievalRepository } from '../retrieval/retrieval.repository';
import { MemoryRetriever } from '../retrieval/memory-retriever';
import { SemanticRetrievalService } from '../retrieval/semantic-retrieval.service';
import { EmbeddingGenerator, EmbeddingCache, EmbeddingService } from '@interrupt-iq/embedding-engine';
import { cacheService } from '../../services/cache.service';

export async function memoryRoutes(fastify: FastifyInstance) {
  // Protect all memory routes before schema validation
  fastify.addHook('preValidation', authenticate);

  const repository = new MemoryRepository(fastify.prisma);
  const searchService = new SearchService(repository);
  const service = new MemoryService(repository, searchService);

  const retrievalRepository = new RetrievalRepository(fastify.prisma);
  const memoryRetriever = new MemoryRetriever(retrievalRepository);
  const semanticRetrievalService = new SemanticRetrievalService(memoryRetriever);

  const embeddingGenerator = new EmbeddingGenerator();
  const embeddingCache = new EmbeddingCache(1000, {
    get: async (key) => cacheService.get<number[]>(key),
    set: async (key, val) => cacheService.set(key, val, 24 * 3600),
  });
  const embeddingService = new EmbeddingService(embeddingGenerator, embeddingCache);

  // POST /api/v1/memory
  fastify.post(
    '/',
    {
      schema: {
        description: 'Index a decision outcome as an immutable memory episode',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['decisionId'],
          properties: {
            decisionId: { type: 'string', format: 'uuid' },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              episode: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  eventId: { type: 'string', nullable: true },
                  decisionId: { type: 'string', nullable: true },
                  contextSnapshotId: { type: 'string', nullable: true },
                  decisionType: { type: 'string' },
                  explanation: { type: 'string' },
                  matchedRules: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  feedbackSummary: { type: 'string', nullable: true },
                  outcome: { type: 'string' },
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
      const bodyParsed = CreateMemoryEpisodeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const episode = await service.createEpisode(request.user.id, bodyParsed.data);
      return reply.status(201).send({
        success: true,
        episode,
      });
    }
  );

  // GET /api/v1/memory
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get paginated memory episodes history',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            decisionType: { type: 'string' },
            category: { type: 'string' },
            userAction: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            minConfidence: { type: 'number' },
            keyword: { type: 'string' },
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
                    eventId: { type: 'string', nullable: true },
                    decisionId: { type: 'string', nullable: true },
                    contextSnapshotId: { type: 'string', nullable: true },
                    decisionType: { type: 'string' },
                    explanation: { type: 'string' },
                    matchedRules: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    feedbackSummary: { type: 'string', nullable: true },
                    outcome: { type: 'string' },
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
      const queryParsed = MemorySearchSchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new BadRequestError('Invalid query parameters', queryParsed.error.format());
      }

      const history = await service.searchEpisodes(request.user.id, queryParsed.data);
      return reply.status(200).send({
        success: true,
        ...history,
      });
    }
  );

  // GET /api/v1/memory/search
  fastify.get(
    '/search',
    {
      schema: {
        description: 'Query and search context history (semantic query layer helper)',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            decisionType: { type: 'string' },
            category: { type: 'string' },
            userAction: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            minConfidence: { type: 'number' },
            keyword: { type: 'string' },
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
                    eventId: { type: 'string', nullable: true },
                    decisionId: { type: 'string', nullable: true },
                    contextSnapshotId: { type: 'string', nullable: true },
                    decisionType: { type: 'string' },
                    explanation: { type: 'string' },
                    matchedRules: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    feedbackSummary: { type: 'string', nullable: true },
                    outcome: { type: 'string' },
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
      const queryParsed = MemorySearchSchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new BadRequestError('Invalid query parameters', queryParsed.error.format());
      }

      const results = await service.searchEpisodes(request.user.id, queryParsed.data);
      return reply.status(200).send({
        success: true,
        ...results,
      });
    }
  );

  // GET /api/v1/memory/:id
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get details of a specific memory episode by ID',
        tags: ['Memory'],
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
              episode: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  eventId: { type: 'string', nullable: true },
                  decisionId: { type: 'string', nullable: true },
                  contextSnapshotId: { type: 'string', nullable: true },
                  decisionType: { type: 'string' },
                  explanation: { type: 'string' },
                  matchedRules: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  feedbackSummary: { type: 'string', nullable: true },
                  outcome: { type: 'string' },
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
      const { id } = request.params as { id: string };
      const episode = await service.getEpisodeById(id, request.user.id);
      return reply.status(200).send({
        success: true,
        episode,
      });
    }
  );

  // POST /api/v1/memory/retrieve
  fastify.post(
    '/retrieve',
    {
      schema: {
        description: 'Perform metadata-based semantic retrieval to rank historical memory episodes',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            decisionType: { type: 'string', nullable: true },
            eventSource: { type: 'string', nullable: true },
            category: { type: 'string', nullable: true },
            priority: { type: 'string', nullable: true },
            minConfidence: { type: 'number', minimum: 0, maximum: 1, nullable: true },
            maxConfidence: { type: 'number', minimum: 0, maximum: 1, nullable: true },
            feedbackType: { type: 'string', nullable: true },
            keyword: { type: 'string', nullable: true },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
            currentContext: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
              properties: {
                focusLevel: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
                workingMode: { type: 'string', nullable: true },
                activity: { type: 'string', nullable: true },
              },
            },
            targetConfidence: { type: 'number', minimum: 0, maximum: 1, nullable: true },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
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
                    episode: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        eventId: { type: 'string', nullable: true },
                        decisionId: { type: 'string', nullable: true },
                        contextSnapshotId: { type: 'string', nullable: true },
                        decisionType: { type: 'string' },
                        explanation: { type: 'string' },
                        matchedRules: { type: 'array', items: { type: 'string' } },
                        confidence: { type: 'number' },
                        feedbackSummary: { type: 'string', nullable: true },
                        outcome: { type: 'string' },
                        metadata: { type: 'object', additionalProperties: true, nullable: true },
                        createdAt: { type: 'string' },
                      },
                    },
                    relevanceScore: { type: 'integer' },
                    matchingReasons: { type: 'array', items: { type: 'string' } },
                    historicalOutcome: { type: 'string' },
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
      const bodyParsed = MemoryRetrievalSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      // Generate query embedding for hybrid retrieval based on text parameters
      const { category, eventSource, decisionType, keyword } = bodyParsed.data;
      const queryText = [category, eventSource, decisionType, keyword].filter(Boolean).join(' ');
      const queryEmbedding = queryText ? await embeddingService.getEmbedding(queryText) : undefined;

      const results = await semanticRetrievalService.retrieveRelevantMemories(
        request.user.id,
        bodyParsed.data,
        queryEmbedding
      );
      return reply.status(200).send(results);
    }
  );

  // POST /api/v1/memory/embed
  fastify.post(
    '/embed',
    {
      schema: {
        description: 'Generate vector embedding for a specific memory episode',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['decisionId'],
          properties: {
            decisionId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              episode: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  eventId: { type: 'string', nullable: true },
                  decisionId: { type: 'string', nullable: true },
                  contextSnapshotId: { type: 'string', nullable: true },
                  decisionType: { type: 'string' },
                  explanation: { type: 'string' },
                  matchedRules: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  feedbackSummary: { type: 'string', nullable: true },
                  outcome: { type: 'string' },
                  metadata: { type: 'object', additionalProperties: true, nullable: true },
                  embedding: { type: 'array', items: { type: 'number' } },
                  embeddingVersion: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { decisionId } = request.body as { decisionId: string };

      // Load Memory Episode including event relation
      const episode = await fastify.prisma.memoryEpisode.findFirst({
        where: { decisionId, userId: request.user.id },
        include: { event: true },
      });

      if (!episode) {
        return reply.status(404).send({ success: false, message: `Memory Episode not found` });
      }

      // Compile text for vector generation
      const parts = [
        `decision: ${episode.decisionType}`,
        `explanation: ${episode.explanation}`,
        `outcome: ${episode.outcome}`,
      ];
      if (episode.matchedRules && episode.matchedRules.length > 0) {
        parts.push(`rules: ${episode.matchedRules.join(', ')}`);
      }
      if (episode.event) {
        parts.push(
          `source: ${episode.event.source}`,
          `sender: ${episode.event.sender}`,
          `title: ${episode.event.title}`,
          `category: ${episode.event.category}`,
          `priority: ${episode.event.priority}`
        );
      }
      const text = parts.join(' | ');

      const embedding = await embeddingService.getEmbedding(text);
      const updated = await repository.updateEpisodeEmbedding(
        episode.id,
        embedding,
        embeddingService.getVersion()
      );

      return reply.status(200).send({
        success: true,
        episode: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    }
  );

  // POST /api/v1/memory/reindex
  fastify.post(
    '/reindex',
    {
      schema: {
        description: 'Batch index all memory episodes missing vector embeddings',
        tags: ['Memory'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              processedCount: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const version = embeddingService.getVersion();
      const episodes = await repository.findEpisodesNeedingEmbedding(request.user.id, version);

      let count = 0;
      for (const ep of episodes) {
        const parts = [
          `decision: ${ep.decisionType}`,
          `explanation: ${ep.explanation}`,
          `outcome: ${ep.outcome}`,
        ];
        if (ep.matchedRules && ep.matchedRules.length > 0) {
          parts.push(`rules: ${ep.matchedRules.join(', ')}`);
        }
        if (ep.event) {
          parts.push(
            `source: ${ep.event.source}`,
            `sender: ${ep.event.sender}`,
            `title: ${ep.event.title}`,
            `category: ${ep.event.category}`,
            `priority: ${ep.event.priority}`
          );
        }
        const text = parts.join(' | ');

        const embedding = await embeddingService.getEmbedding(text);
        await repository.updateEpisodeEmbedding(ep.id, embedding, version);
        count++;
      }

      return reply.status(200).send({
        success: true,
        processedCount: count,
      });
    }
  );
}
