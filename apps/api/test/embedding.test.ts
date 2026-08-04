import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Embedding Engine and Hybrid Retrieval Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-embedding-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';

  let decisionId1 = '';
  let decisionId2 = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Embedding Tester',
      },
    });
    userId = user.id;

    // Generate JWT
    authToken = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET);

    // Bootstrap Context Snapshots
    const context = await app.prisma.contextSnapshot.create({
      data: {
        userId,
        battery: 85,
        charging: false,
        activity: 'coding',
        timeOfDay: 'afternoon',
        visibility: 'visible',
        network: 'online',
        focusLevel: 80,
        workingMode: 'deep-work',
      },
    });

    // Ingest events
    const event1 = await app.prisma.event.create({
      data: {
        userId,
        source: 'Slack',
        sender: 'Bob',
        title: 'Urgent meeting',
        body: 'Sync on deployment blocker ASAP.',
        category: 'development',
        priority: 'high',
      },
    });

    const event2 = await app.prisma.event.create({
      data: {
        userId,
        source: 'GitHub',
        sender: 'bot',
        title: 'Security Alert',
        body: 'Vulnerability in dependency',
        category: 'development',
        priority: 'high',
      },
    });

    // Create decisions
    const dec1 = await app.prisma.decision.create({
      data: {
        eventId: event1.id,
        decision: 'IMMEDIATE',
        reason: 'Blocker priority',
        confidence: 0.9,
      },
    });
    decisionId1 = dec1.id;

    const dec2 = await app.prisma.decision.create({
      data: {
        eventId: event2.id,
        decision: 'BATCH',
        reason: 'Vulnerability batching',
        confidence: 0.85,
      },
    });
    decisionId2 = dec2.id;

    // Create Memory Episodes (initially without embeddings)
    await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event1.id,
        decisionId: dec1.id,
        contextSnapshotId: context.id,
        decisionType: dec1.decision,
        explanation: dec1.reason,
        matchedRules: ['Focus Rule'],
        confidence: dec1.confidence,
        outcome: 'ACCEPTED',
      },
    });

    await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event2.id,
        decisionId: dec2.id,
        contextSnapshotId: context.id,
        decisionType: dec2.decision,
        explanation: dec2.reason,
        matchedRules: [],
        confidence: dec2.confidence,
        outcome: 'ACCEPTED',
      },
    });
  });

  afterAll(async () => {
    // Delete memory episodes, decisions, events, contexts, and user
    await app.prisma.memoryEpisode.deleteMany({
      where: { userId },
    });
    await app.prisma.decision.deleteMany({
      where: { event: { userId } },
    });
    await app.prisma.event.deleteMany({
      where: { userId },
    });
    await app.prisma.contextSnapshot.deleteMany({
      where: { userId },
    });
    await app.prisma.user.delete({
      where: { id: userId },
    });
    await app.close();
  });

  describe('Authorization Controls', () => {
    it('should reject unauthenticated request for /embed with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/embed',
        payload: { decisionId: decisionId1 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject unauthenticated request for /reindex with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/reindex',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Embedding Generation and Reindexing', () => {
    it('should generate vector embedding for a specific memory episode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/embed',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId: decisionId1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.episode.embedding).toBeDefined();
      expect(body.episode.embedding.length).toBe(384);
      expect(body.episode.embeddingVersion).toBe('bge-small-en-v1.5-local');
    });

    it('should batch reindex missing memory episodes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/reindex',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.processedCount).toBe(1); // 1 episode was remaining
    });
  });

  describe('Hybrid Retrieval and Ranking', () => {
    it('should score and rank candidate memory episodes using cosine similarity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          category: 'development',
          eventSource: 'Slack',
          decisionType: 'IMMEDIATE',
          targetConfidence: 0.9,
          limit: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.items.length).toBe(2);

      // Verify that hybrid score is computed and matches sorted order
      expect(body.items[0].relevanceScore).toBeGreaterThan(body.items[1].relevanceScore);
      expect(
        body.items[0].matchingReasons.some((r: string) =>
          r.includes('Semantic embedding similarity')
        )
      ).toBe(true);
    });
  });
});
