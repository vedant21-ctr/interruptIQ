import { MemoryRepository } from './memory.repository';
import { MemorySearchDto, MemoryEpisodeResponseDto } from './memory.dto';

export class SearchService {
  private repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
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

  async search(
    userId: string,
    query: MemorySearchDto
  ): Promise<{ items: MemoryEpisodeResponseDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await this.repository.searchEpisodes(userId, query);
    
    return {
      items: items.map(item => this.mapToResponseDto(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
