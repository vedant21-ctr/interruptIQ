import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('LLM Critic Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-critic-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';

  let episodeId1 = '';
  let episodeId2 = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Critic Tester',
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
        title: 'Weekly Sync',
        body: 'Sync on project progression.',
        category: 'work',
        priority: 'medium',
      },
    });

    const event2 = await app.prisma.event.create({
      data: {
        userId,
        source: 'Slack',
        sender: 'Alice',
        title: 'Dinner blocker',
        body: 'Are we still on for dinner?',
        category: 'social',
        priority: 'low',
      },
    });

    // Create decisions
    const dec1 = await app.prisma.decision.create({
      data: {
        eventId: event1.id,
        decision: 'BATCH',
        reason: 'Meeting focus mode active',
        confidence: 0.9,
      },
    });

    const dec2 = await app.prisma.decision.create({
      data: {
        eventId: event2.id,
        decision: 'BATCH',
        reason: 'Low priority social event during work hours',
        confidence: 0.85,
      },
    });

    // Add User override feedback to decision 2 to verify overridden logic
    await app.prisma.feedback.create({
      data: {
        decisionId: dec2.id,
        originalDecision: dec2.decision,
        userAction: 'OVERRIDDEN',
        comment: 'This was urgent family dinner plans, should have delivered immediately.',
      },
    });

    // Create Memory Episodes
    const ep1 = await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event1.id,
        decisionId: dec1.id,
        contextSnapshotId: context.id,
        decisionType: dec1.decision,
        explanation: dec1.reason,
        matchedRules: ['Meeting Rule'],
        confidence: dec1.confidence,
        outcome: 'ACCEPTED',
      },
    });
    episodeId1 = ep1.id;

    const ep2 = await app.prisma.memoryEpisode.create({
      data: {
        userId,
        eventId: event2.id,
        decisionId: dec2.id,
        contextSnapshotId: context.id,
        decisionType: dec2.decision,
        explanation: dec2.reason,
        matchedRules: ['Social Hours Rule'],
        confidence: dec2.confidence,
        outcome: 'OVERRIDDEN',
      },
    });
    episodeId2 = ep2.id;
  });

  afterAll(async () => {
    // Teardown
    await app.prisma.criticEvaluation.deleteMany({
      where: { userId },
    });
    await app.prisma.memoryEpisode.deleteMany({
      where: { userId },
    });
    await app.prisma.feedback.deleteMany({
      where: {
        decision: {
          event: {
            userId,
          },
        },
      },
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

  describe('Authorization and Input Validation', () => {
    it('should reject unauthenticated request with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        payload: { episodeId: episodeId1 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject non-uuid episode ID validation with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { episodeId: 'invalid-uuid-format' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Critic Evaluation Generation', () => {
    it('should generate and store appropriate evaluation for accepted episode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          episodeId: episodeId1,
          provider: 'mock',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.evaluation.verdict).toBe('APPROPRIATE');
      expect(body.evaluation.confidence).toBe(0.95);
      expect(body.evaluation.explanation).toContain('matches user expectations');
      expect(body.evaluation.suggestedRuleChanges).toEqual([]);
      expect(body.evaluation.strengths.length).toBeGreaterThan(0);
      expect(body.evaluation.rawPrompt).toContain('You are the AI Critic');
    });

    it('should generate inappropriate evaluation with suggested changes for overridden episode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/critic/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          episodeId: episodeId2,
          provider: 'mock',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.evaluation.verdict).toBe('INAPPROPRIATE');
      expect(body.evaluation.confidence).toBe(0.85);
      expect(body.evaluation.explanation).toContain('user overrode the decision');
      expect(body.evaluation.suggestedRuleChanges.length).toBe(1);
      expect(body.evaluation.suggestedRuleChanges[0].action).toBe('ADJUST');
    });
  });

  describe('History and Details Retrieval', () => {
    it('should fetch paginated history of critic reports', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/critic/history',
        headers: { Authorization: `Bearer ${authToken}` },
        query: {
          page: '1',
          limit: '10',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(2);
      expect(body.items.length).toBe(2);
      expect(body.items[0].verdict).toBeDefined();
    });

    it('should fetch details of a specific evaluation by ID', async () => {
      // Get an evaluation ID from database
      const evaluation = await app.prisma.criticEvaluation.findFirst({
        where: { userId },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/critic/${evaluation?.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.evaluation.id).toBe(evaluation?.id);
      expect(body.evaluation.rawPrompt).toBeDefined();
    });
  });
});
