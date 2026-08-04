import { FeedbackRepository } from './feedback.repository';
import { CreateFeedbackDto, FeedbackResponseDto, FeedbackAnalyticsResponseDto } from './feedback.dto';
import { NotFoundError } from '../../errors/app-error';
import { cacheService } from '../../services/cache.service';

export class FeedbackService {
  private repository: FeedbackRepository;

  constructor(repository: FeedbackRepository) {
    this.repository = repository;
  }

  private mapToResponseDto(feedback: any): FeedbackResponseDto {
    return {
      id: feedback.id,
      decisionId: feedback.decisionId,
      originalDecision: feedback.originalDecision,
      userAction: feedback.userAction,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    };
  }

  async createFeedback(userId: string, data: CreateFeedbackDto): Promise<FeedbackResponseDto> {
    const decision = await this.repository.findDecisionById(data.decisionId, userId);
    if (!decision) {
      throw new NotFoundError(`Decision with ID ${data.decisionId} not found`);
    }

    const created = await this.repository.createFeedback({
      decisionId: data.decisionId,
      originalDecision: decision.decision,
      userAction: data.userAction,
      comment: data.comment || null,
    });

    // Invalidate cached analytics rollups and lists
    await cacheService.invalidate(`feedback:analytics:${userId}`);

    return this.mapToResponseDto(created);
  }

  async getFeedbackById(id: string, userId: string): Promise<FeedbackResponseDto> {
    const feedback = await this.repository.findFeedbackById(id, userId);
    if (!feedback) {
      throw new NotFoundError(`Feedback with ID ${id} not found`);
    }
    return this.mapToResponseDto(feedback);
  }

  async getFeedbackAnalytics(userId: string): Promise<FeedbackAnalyticsResponseDto> {
    const cacheKey = `feedback:analytics:${userId}`;
    const cached = await cacheService.get<FeedbackAnalyticsResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const feedbacks = await this.repository.findManyByUserId(userId);
    const total = feedbacks.length;

    if (total === 0) {
      const emptyAnalytics = {
        overrideRate: 0.0,
        acceptanceRate: 0.0,
        dismissRate: 0.0,
        totalFeedbacks: 0,
      };
      await cacheService.set(cacheKey, emptyAnalytics, 600);
      return emptyAnalytics;
    }

    const overrides = feedbacks.filter(f => f.userAction === 'OVERRIDDEN').length;
    const acceptances = feedbacks.filter(f => f.userAction === 'ACCEPTED').length;
    const dismissals = feedbacks.filter(f => f.userAction === 'DISMISSED').length;

    const result = {
      overrideRate: overrides / total,
      acceptanceRate: acceptances / total,
      dismissRate: dismissals / total,
      totalFeedbacks: total,
    };

    await cacheService.set(cacheKey, result, 600);
    return result;
  }
}
