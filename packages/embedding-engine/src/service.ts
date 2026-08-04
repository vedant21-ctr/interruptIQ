import { EmbeddingProvider } from './interfaces';
import { EmbeddingCache } from './cache';

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private cache: EmbeddingCache;

  constructor(provider: EmbeddingProvider, cache: EmbeddingCache) {
    this.provider = provider;
    this.cache = cache;
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      return new Array(384).fill(0); // Return empty zero vector
    }

    const cached = await this.cache.get(text);
    if (cached) {
      return cached;
    }

    const generated = await this.provider.generateEmbedding(text);
    await this.cache.set(text, generated);
    return generated;
  }

  getVersion(): string {
    return this.provider.getVersion();
  }
}
