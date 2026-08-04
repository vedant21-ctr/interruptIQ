import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware';
import { FeedbackRepository } from './feedback.repository';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackSchema } from './feedback.dto';
import { BadRequestError } from '../../errors/app-error';

export async function feedbackRoutes(fastify: FastifyInstance) {
  // Protect all feedback routes before schema validation
  fastify.addHook('preValidation', authenticate);

  const repository = new FeedbackRepository(fastify.prisma);
  const service = new FeedbackService(repository);

  // POST /api/v1/feedback
  fastify.post(
    '/',
    {
      schema: {
        description: 'Provide feedback for a decision outcome',
        tags: ['Feedback'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['decisionId', 'userAction'],
          properties: {
            decisionId: { type: 'string', format: 'uuid' },
            userAction: { type: 'string', enum: ['ACCEPTED', 'OVERRIDDEN', 'DISMISSED', 'RESTORED', 'CUSTOM'] },
            comment: { type: 'string', nullable: true },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              feedback: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  decisionId: { type: 'string' },
                  originalDecision: { type: 'string' },
                  userAction: { type: 'string' },
                  comment: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = CreateFeedbackSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const feedback = await service.createFeedback(request.user.id, bodyParsed.data);
      return reply.status(201).send({
        success: true,
        feedback,
      });
    }
  );

  // GET /api/v1/feedback
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get decision timing feedback analytics for the authenticated user',
        tags: ['Feedback'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              analytics: {
                type: 'object',
                properties: {
                  overrideRate: { type: 'number' },
                  acceptanceRate: { type: 'number' },
                  dismissRate: { type: 'number' },
                  totalFeedbacks: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const analytics = await service.getFeedbackAnalytics(request.user.id);
      return reply.status(200).send({
        success: true,
        analytics,
      });
    }
  );

  // GET /api/v1/feedback/:id
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get feedback details by ID',
        tags: ['Feedback'],
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
              feedback: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  decisionId: { type: 'string' },
                  originalDecision: { type: 'string' },
                  userAction: { type: 'string' },
                  comment: { type: 'string', nullable: true },
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
      const feedback = await service.getFeedbackById(id, request.user.id);
      return reply.status(200).send({
        success: true,
        feedback,
      });
    }
  );
}
