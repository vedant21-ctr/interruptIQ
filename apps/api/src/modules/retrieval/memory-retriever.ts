import { RetrievalRepository } from './retrieval.repository';
import { RankingService } from './ranking.service';
import { MemoryRetrievalDto, RetrievalResultItemDto } from '../memory/retrieval.dto';

export class MemoryRetriever {
  private repository: RetrievalRepository;

  constructor(repository: RetrievalRepository) {
    this.repository = repository;
  }

  async retrieve(
    userId: string,
    query: MemoryRetrievalDto,
    queryEmbedding?: number[]
  ): Promise<{ items: RetrievalResultItemDto[]; total: number }> {
    // 1. Fetch matching candidates from repository
    const candidates = await this.repository.findCandidates(userId, query);

    // 2. Rank candidates deterministically
    const ranked = RankingService.rank(candidates, query, queryEmbedding);

    return {
      items: ranked,
      total: ranked.length,
    };
  }
}
