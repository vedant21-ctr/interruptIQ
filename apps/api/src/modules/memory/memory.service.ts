import { MemoryRepository } from './memory.repository';
import { SearchService } from './search.service';
import { CreateMemoryEpisodeDto, MemorySearchDto, MemoryEpisodeResponseDto } from './memory.dto';
import { NotFoundError, BadRequestError } from '../../errors/app-error';
import { cacheService } from '../../services/cache.service';

export class MemoryService {
  private repository: MemoryRepository;
  private searchService: SearchService;

  constructor(repository: MemoryRepository, searchService: SearchService) {
    this.repository = repository;
    this.searchService = searchService;
  }

  private mapToResponseDto(episode: any): MemoryEpisodeResponseDto {
    return {
      id: episode.id,
      userId: episode.userId,
      eventId: episode.eventId,
      decisionId: episode.decisionId,
      contextSnapshotId: episode.contextSnapshotId,
      decisionType: episode.decisionType,
      explanation: episode.explanation,
      matchedRules: episode.matchedRules,
      confidence: episode.confidence,
      feedbackSummary: episode.feedbackSummary,
      outcome: episode.outcome,
      metadata: (episode.metadata as Record<string, any>) || null,
      createdAt: episode.createdAt.toISOString(),
    };
  }

  async createEpisode(userId: string, data: CreateMemoryEpisodeDto): Promise<MemoryEpisodeResponseDto> {
    // Duplicate prevention
    const existing = await this.repository.findEpisodeByDecisionId(data.decisionId);
    if (existing) {
      throw new BadRequestError('Memory Episode already exists for this Decision');
    }

    const decision = await this.repository.findDecisionWithDetails(data.decisionId, userId);
    if (!decision) {
      throw new NotFoundError(`Decision with ID ${data.decisionId} not found`);
    }

    // Feedback summary construction
    const feedbackSummary = decision.feedbacks.length > 0
      ? decision.feedbacks.map(f => `${f.userAction}: ${f.comment || ''}`).join('; ')
      : null;

    // Outcome resolves to user override if available, else original decision type
    const outcome = decision.feedbacks[0]?.userAction || decision.decision;

    const created = await this.repository.createEpisode({
      userId,
      eventId: decision.eventId,
      decisionId: decision.id,
      contextSnapshotId: decision.contextSnapshotId,
      decisionType: decision.decision,
      explanation: decision.explanation?.narrative || decision.reason,
      matchedRules: decision.signalsUsed,
      confidence: decision.confidence,
      feedbackSummary,
      outcome,
      metadata: data.metadata || undefined,
    });

    // Invalidate semantic retrieval and feedback stats cache
    await cacheService.invalidateByPrefix(`retrieval:${userId}`);
    await cacheService.invalidate(`feedback:analytics:${userId}`);

    return this.mapToResponseDto(created);
  }

  async getEpisodeById(id: string, userId: string): Promise<MemoryEpisodeResponseDto> {
    const episode = await this.repository.findEpisodeById(id, userId);
    if (!episode) {
      throw new NotFoundError(`Memory Episode with ID ${id} not found`);
    }
    return this.mapToResponseDto(episode);
  }

  async searchEpisodes(
    userId: string,
    query: MemorySearchDto
  ): Promise<{ items: MemoryEpisodeResponseDto[]; total: number; page: number; limit: number }> {
    return this.searchService.search(userId, query);
  }
}
