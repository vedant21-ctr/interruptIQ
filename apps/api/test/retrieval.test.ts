import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Semantic Retrieval Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-retrieval-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';

  // Decsision and Event IDs for seeding memory episodes
  let decisionId1 = '';
  let decisionId2 = '';
  let decisionId3 = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Retrieval Tester',
      },
    });
    userId = user.id;

    // Generate JWT
    authToken = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET);

    // Bootstrap Context Snapshots
    const context1 = await app.prisma.contextSnapshot.create({
      data: {
        userId,
        battery: 90,
        charging: false,
        activity: 'coding',
        timeOfDay: 'afternoon',
        visibility: 'visible',
        network: 'online',
        focusLevel: 80,
        workingMode: 'deep-work',
      },
    });

    const context2 = await app.prisma.contextSnapshot.create({
      data: {
        userId,
        battery: 80,
        charging: false,
        activity: 'meeting',
        timeOfDay: 'afternoon',
        visibility: 'visible',
        network: 'online',
        focusLevel: 40,
        workingMode: 'MEETING',
      },
    });

    // Ingest events
    const event1 = await app.prisma.event.create({
      data: {
        userId,
        source: 'Slack',
        sender: 'Bob',
        title: 'Blocker sync',
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
        title: 'Security alert',
        body: 'Vulnerability in dependency',
        category: 'development',
        priority: 'high',
      },
    });

    const event3 = await app.prisma.event.create({
      data: {
        userId,
        source: 'Slack',
        sender: 'Alice',
        title: 'Lunch',
        body: 'Lunch details',
        category: 'social',
        priority: 'low',
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

    const dec3 = await app.prisma.decision.create({
      data: {
        eventId: event3.id,
        decision: 'SILENT',
        reason: 'Social meeting silence',
        confidence: 0.7,
      },
    });
    decisionId3 = dec3.id;

    // Create Memory Episodes
    await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event1.id,
        decisionId: dec1.id,
        contextSnapshotId: context1.id,
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
        contextSnapshotId: context1.id,
        decisionType: dec2.decision,
        explanation: dec2.reason,
        matchedRules: [],
        confidence: dec2.confidence,
        outcome: 'ACCEPTED',
      },
    });

    await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event3.id,
        decisionId: dec3.id,
        contextSnapshotId: context2.id,
        decisionType: dec3.decision,
        explanation: dec3.reason,
        matchedRules: ['Meeting Rule'],
        confidence: dec3.confidence,
        outcome: 'DISMISSED',
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

  describe('Authorization and Validation Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        payload: { category: 'development' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid validation payload with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          minConfidence: 1.5, // invalid confidence range > 1.0
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Retrieval and Deterministic Ranking', () => {
    it('should retrieve candidate episodes matching filters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          category: 'social',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(1);
      expect(body.items[0].episode.decisionType).toBe('SILENT');
    });

    it('should calculate ranking scores deterministically and sort descending', async () => {
      // Query parameters:
      // - category: development (+40)
      // - eventSource: Slack (+25)
      // - decisionType: IMMEDIATE (+20)
      // - targetConfidence: 0.9
      // - currentContext: focusLevel = 75 (cand 1 has 80 delta=5 <= 15 -> +10; cand 2 has 80 delta=5 <= 15 -> +10)
      //
      // Candidate 1 (eventId1): category = development (+40), source = Slack (+25), decision = IMMEDIATE (+20), confidence = 0.9 (delta=0 <= 0.1 -> +15), focusLevel = 80 (delta=5 <= 15 -> +10)
      // Total Score for Cand 1 = 40 + 25 + 20 + 15 + 10 = 110.
      //
      // Candidate 2 (eventId2): category = development (+40), source = GitHub (no source match), decision = BATCH (no decision match), confidence = 0.85 (delta=0.05 <= 0.1 -> +15), focusLevel = 80 (delta=5 <= 15 -> +10)
      // Total Score for Cand 2 = 40 + 15 + 10 = 65.
      //
      // Candidate 3 (eventId3): category = social (no category match), source = Slack (+25), decision = SILENT (no decision match), confidence = 0.7 (delta=0.2 > 0.1 -> no conf match), focusLevel = 40 (delta=35 > 15 -> no focus match)
      // Total Score for Cand 3 = 25.

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          category: 'development',
          eventSource: 'Slack',
          decisionType: 'IMMEDIATE',
          targetConfidence: 0.9,
          currentContext: {
            focusLevel: 75,
          },
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.items.length).toBe(3);

      // Verify scores and ordering
      expect(body.items[0].relevanceScore).toBe(110);
      expect(body.items[1].relevanceScore).toBe(65);
      expect(body.items[2].relevanceScore).toBe(25);

      // Explanations/matching reasons check
      expect(body.items[0].matchingReasons).toContain('Matched same category: development (+40)');
      expect(body.items[0].matchingReasons).toContain('Matched same event source: Slack (+25)');
      expect(body.items[0].matchingReasons).toContain(
        'Matched same decision type: IMMEDIATE (+20)'
      );
    });

    it('should respect retrieval pagination limits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory/retrieve',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          category: 'development',
          page: 2,
          limit: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(2); // total matches is 2 (eventId1 and eventId2 match 'development')
      expect(body.items.length).toBe(1); // returned is 1 due to limit
    });
  });
});
