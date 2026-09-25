import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware';
import { FocusReportRepository } from './focus-report.repository';
import { FocusReportService } from './focus-report.service';

const GenerateReportSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

const SubmitReviewSchema = z.object({
  reportId: z.string(),
  interruptionId: z.string(),
  verdict: z.enum(['AGREE', 'UNSURE', 'DISAGREE']),
  comment: z.string().optional(),
});

export async function focusReportRoutes(fastify: FastifyInstance) {
  const repository = new FocusReportRepository(fastify.prisma);
  const service = new FocusReportService(repository);

  // POST /api/v1/focus-report/generate - Generate Focus Report from persisted integration data
  fastify.post('/generate', { preHandler: [authenticate] }, async (request, reply) => {
    const { startAt, endAt } = GenerateReportSchema.parse(request.body || {});
    const userId = request.user.id;

    const report = await service.generateFocusReport(userId, { startAt, endAt });

    return reply.status(200).send({
      success: true,
      report,
    });
  });

  // POST /api/v1/focus-report/reviews - Submit a verdict on a sampled decision
  fastify.post('/reviews', { preHandler: [authenticate] }, async (request, reply) => {
    const data = SubmitReviewSchema.parse(request.body);
    const userId = request.user.id;

    const review = await service.submitReview(userId, data);

    return reply.status(201).send({
      success: true,
      review,
    });
  });

  fastify.post('/review', { preHandler: [authenticate] }, async (request, reply) => {
    const data = SubmitReviewSchema.parse(request.body);
    const userId = request.user.id;

    const review = await service.submitReview(userId, data);

    return reply.status(201).send({
      success: true,
      review,
    });
  });
}

