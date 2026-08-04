import { MemoryRetrievalDto, RetrievalResultItemDto } from '../memory/retrieval.dto';
import { cosineSimilarity } from '@interrupt-iq/embedding-engine';

export class RankingService {
  static rank(
    candidates: any[],
    query: MemoryRetrievalDto,
    queryEmbedding?: number[]
  ): RetrievalResultItemDto[] {
    const scored = candidates.map((c) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Same category (+40)
      if (query.category && c.event?.category === query.category) {
        score += 40;
        reasons.push(`Matched same category: ${query.category} (+40)`);
      }

      // 2. Same event source (+25)
      if (query.eventSource && c.event?.source === query.eventSource) {
        score += 25;
        reasons.push(`Matched same event source: ${query.eventSource} (+25)`);
      }

      // 3. Same decision type (+20)
      if (query.decisionType && c.decisionType === query.decisionType) {
        score += 20;
        reasons.push(`Matched same decision type: ${query.decisionType} (+20)`);
      }

      // 4. Similar confidence (+15)
      const targetConf =
        query.targetConfidence !== undefined && query.targetConfidence !== null
          ? query.targetConfidence
          : query.minConfidence !== undefined && query.minConfidence !== null
            ? query.minConfidence
            : null;

      if (targetConf !== null) {
        const delta = Math.abs(c.confidence - targetConf);
        if (delta <= 0.1) {
          score += 15;
          reasons.push(`Similar confidence level (delta: ${delta.toFixed(2)}) (+15)`);
        }
      }

      // 5. Context-based matching (up to +30)
      if (query.currentContext && c.contextSnapshot) {
        const inputCtx = query.currentContext;
        const candCtx = c.contextSnapshot;

        // Same workingMode (+10)
        if (inputCtx.workingMode && candCtx.workingMode === inputCtx.workingMode) {
          score += 10;
          reasons.push(`Matched working mode: ${inputCtx.workingMode} (+10)`);
        }

        // Same activity (+10)
        if (inputCtx.activity && candCtx.activity === inputCtx.activity) {
          score += 10;
          reasons.push(`Matched activity: ${inputCtx.activity} (+10)`);
        }

        // Focus Level within 15 units delta (+10)
        if (
          inputCtx.focusLevel !== undefined &&
          inputCtx.focusLevel !== null &&
          candCtx.focusLevel !== undefined &&
          candCtx.focusLevel !== null
        ) {
          const focusDelta = Math.abs(candCtx.focusLevel - inputCtx.focusLevel);
          if (focusDelta <= 15) {
            score += 10;
            reasons.push(`Similar focus level (delta: ${focusDelta}) (+10)`);
          }
        }
      }

      // 6. Vector Cosine Similarity (Hybrid Match)
      let finalScore = score;
      if (queryEmbedding && c.embedding && c.embedding.length > 0) {
        try {
          const sim = cosineSimilarity(queryEmbedding, c.embedding);
          const embeddingScore = sim * 100;
          // Hybrid: 50% metadata, 50% embedding similarity
          finalScore = Math.round(0.5 * score + 0.5 * embeddingScore);
          reasons.push(
            `Semantic embedding similarity: ${sim.toFixed(4)} (embedding score: ${embeddingScore.toFixed(1)})`
          );
        } catch (err) {
          // Fallback on vector dimensions error or other mismatch
        }
      }

      return {
        episode: {
          id: c.id,
          userId: c.userId,
          eventId: c.eventId,
          decisionId: c.decisionId,
          contextSnapshotId: c.contextSnapshotId,
          decisionType: c.decisionType,
          explanation: c.explanation,
          matchedRules: c.matchedRules,
          confidence: c.confidence,
          feedbackSummary: c.feedbackSummary,
          outcome: c.outcome,
          metadata: c.metadata,
          createdAt: c.createdAt.toISOString(),
        },
        relevanceScore: finalScore,
        matchingReasons: reasons.length > 0 ? reasons : ['No specific metadata matches found'],
        historicalOutcome: c.outcome,
      };
    });

    const hasSoftCriteria = !!(
      query.category ||
      query.eventSource ||
      query.decisionType ||
      (query.targetConfidence !== undefined && query.targetConfidence !== null) ||
      (query.minConfidence !== undefined && query.minConfidence !== null) ||
      query.currentContext
    );

    const filtered = hasSoftCriteria ? scored.filter((item) => item.relevanceScore > 0) : scored;

    // Sort descending by relevance score, then by createdAt descending as fallback
    return filtered.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.episode.createdAt).getTime() - new Date(a.episode.createdAt).getTime();
    });
  }
}
