import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware';
import { FocusReportRepository } from './focus-report.repository';
import { FocusReportService } from './focus-report.service';

const GenerateReportSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

const HarmCategorySchema = z.enum([
  'FALSE_POSITIVE_URGENCY',
  'VIP_SENDER_MISSED',
  'NEEDED_IMMEDIATE_REPLY',
  'OTHER',
]);

const SubmitReviewSchema = z.object({
  reportId: z.string(),
  interruptionId: z.string(),
  verdict: z.enum(['AGREE', 'UNSURE', 'DISAGREE']),
  comment: z.string().optional(),
  harmCategory: HarmCategorySchema.optional(),
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

const CalibrationQuerySchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  policyVersion: z.string().optional(),
  minSamples: z.coerce.number().optional(),
});

  // GET /api/v1/focus-report/evaluation-summary - Retrieve aggregated evaluation metrics
  fastify.get('/evaluation-summary', { preHandler: [authenticate] }, async (request, reply) => {
    const { startAt, endAt } = GenerateReportSchema.parse(request.query || {});
    const userId = request.user.id;

    const summary = await service.getEvaluationSummary(userId, { startAt, endAt });

    return reply.status(200).send({
      success: true,
      summary,
    });
  });

  // GET /api/v1/focus-report/calibration-analysis - Retrieve evidence-based calibration report
  fastify.get('/calibration-analysis', { preHandler: [authenticate] }, async (request, reply) => {
    const { startAt, endAt, policyVersion, minSamples } = CalibrationQuerySchema.parse(
      request.query || {}
    );
    const userId = request.user.id;

    const analysis = await service.getCalibrationAnalysis(userId, {
      startAt,
      endAt,
      policyVersion,
      minCalibrationSamples: minSamples,
    });

    return reply.status(200).send({
      success: true,
      analysis,
    });
  });
}

