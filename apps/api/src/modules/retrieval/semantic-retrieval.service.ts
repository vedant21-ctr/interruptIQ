import { MemoryRetriever } from './memory-retriever';
import { MemoryRetrievalDto, RetrievalResponseDto } from '../memory/retrieval.dto';
import { cacheService } from '../../services/cache.service';

export class SemanticRetrievalService {
  private retriever: MemoryRetriever;

  constructor(retriever: MemoryRetriever) {
    this.retriever = retriever;
  }

  async retrieveRelevantMemories(
    userId: string,
    query: MemoryRetrievalDto,
    queryEmbedding?: number[]
  ): Promise<RetrievalResponseDto> {
    const cacheKey = `retrieval:${userId}:${JSON.stringify(query)}`;
    const cached = await cacheService.get<RetrievalResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const { items, total } = await this.retriever.retrieve(userId, query, queryEmbedding);

    // Apply pagination on ranked results in-memory
    const page = query.page || 1;
    const limit = query.limit || 5;
    const skip = (page - 1) * limit;

    const paginatedItems = items.slice(skip, skip + limit);

    const response = {
      success: true,
      items: paginatedItems,
      total,
      page,
      limit,
    };

    await cacheService.set(cacheKey, response, 300); // Cache for 5 minutes
    return response;
  }
}
