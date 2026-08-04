export interface EmbeddingCacheDelegate {
  get(key: string): Promise<number[] | null> | number[] | null;
  set(key: string, val: number[]): Promise<void> | void;
}

export class EmbeddingCache {
  private cache: Map<string, number[]>;
  private maxKeys: number;
  private delegate?: EmbeddingCacheDelegate;

  constructor(maxKeys: number = 1000, delegate?: EmbeddingCacheDelegate) {
    this.cache = new Map();
    this.maxKeys = maxKeys;
    this.delegate = delegate;
  }

  async get(text: string): Promise<number[] | undefined> {
    if (this.delegate) {
      const val = await this.delegate.get(`embedding:${text}`);
      return val || undefined;
    }
    if (!this.cache.has(text)) return undefined;
    const val = this.cache.get(text)!;
    this.cache.delete(text);
    this.cache.set(text, val);
    return val;
  }

  async set(text: string, embedding: number[]): Promise<void> {
    if (this.delegate) {
      await this.delegate.set(`embedding:${text}`, embedding);
      return;
    }
    if (this.cache.has(text)) {
      this.cache.delete(text);
    } else if (this.cache.size >= this.maxKeys) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(text, embedding);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
