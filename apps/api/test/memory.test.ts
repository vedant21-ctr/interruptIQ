import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Episodic Memory Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-memory-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';
  let decisionId = '';
  let secondaryDecisionId = '';
  let episodeId = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Memory Tester',
      },
    });
    userId = user.id;

    // Generate JWT
    authToken = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET);

    // Bootstrap an Event and a Decision
    const event = await app.prisma.event.create({
      data: {
        userId,
        source: 'Slack',
        sender: 'David',
        title: 'Deployment Sync',
        body: 'Deployment is happening now. Please verify dashboard builds ASAP.',
        category: 'development',
        priority: 'high',
      },
    });

    const decision = await app.prisma.decision.create({
      data: {
        eventId: event.id,
        decision: 'IMMEDIATE',
        reason: 'Keywords matched priority',
        confidence: 0.95,
        signalsUsed: ['Keyword Detector', 'Slack VIP Rule'],
      },
    });
    decisionId = decision.id;

    // Create a second decision
    const secondEvent = await app.prisma.event.create({
      data: {
        userId,
        source: 'Email',
        sender: 'News',
        title: 'Weekly digest',
        body: 'Here is your weekly news update.',
        category: 'social',
        priority: 'low',
      },
    });

    const secondDecision = await app.prisma.decision.create({
      data: {
        eventId: secondEvent.id,
        decision: 'BATCH',
        reason: 'Low priority social digest',
        confidence: 0.8,
      },
    });
    secondaryDecisionId = secondDecision.id;
  });

  afterAll(async () => {
    // Clean up all user relations
    await app.prisma.memoryEpisode.deleteMany({
      where: { userId },
    });
    await app.prisma.decision.deleteMany({
      where: { event: { userId } },
    });
    await app.prisma.event.deleteMany({
      where: { userId },
    });
    await app.prisma.user.delete({
      where: { id: userId },
    });
    await app.close();
  });

  describe('Unauthenticated Access Control', () => {
    it('should block POST / with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory',
        payload: { decisionId },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Memory Episode Creation & Lifecycle', () => {
    it('should create a memory episode successfully and build feedback summary', async () => {
      // Add feedback to the decision first
      await app.prisma.feedback.create({
        data: {
          decisionId,
          originalDecision: 'IMMEDIATE',
          userAction: 'ACCEPTED',
          comment: 'Perfect timing, blocker alert',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId,
          metadata: { tags: ['deploy', 'sync'] },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.episode.id).toBeDefined();
      expect(body.episode.decisionType).toBe('IMMEDIATE');
      expect(body.episode.confidence).toBe(0.95);
      expect(body.episode.feedbackSummary).toContain('ACCEPTED: Perfect timing');
      expect(body.episode.outcome).toBe('ACCEPTED');
      expect(body.episode.metadata).toEqual({ tags: ['deploy', 'sync'] });

      episodeId = body.episode.id;
    });

    it('should prevent duplicate memory episodes for the same decision with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/memory',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('already exists');
    });

    it('should fetch a single memory episode by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/memory/${episodeId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.episode.id).toBe(episodeId);
    });
  });

  describe('Memory Search and Filtering', () => {
    beforeAll(async () => {
      // Ingest the second episode to have comparison logs
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/memory',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId: secondaryDecisionId,
        },
      });
      if (res.statusCode !== 201) {
        console.error('Ingest second episode failed:', res.statusCode, res.body);
      }
    });

    it('should list and search memory episodes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/memory/search',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(2);
    });

    it('should filter by decisionType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/memory/search',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { decisionType: 'BATCH' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.items[0].decisionType).toBe('BATCH');
    });

    it('should filter by event category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/memory/search',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { category: 'development' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.items[0].decisionType).toBe('IMMEDIATE');
    });

    it('should search by keyword in explanation or matchedRules', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/memory/search',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { keyword: 'Slack VIP Rule' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.items[0].decisionType).toBe('IMMEDIATE');
    });
  });

  describe('Prisma Decision Deletion Safety Rule', () => {
    it('should keep the memory episode intact after deleting the parent decision', async () => {
      // 1. Delete parent decision
      await app.prisma.decision.delete({
        where: { id: decisionId },
      });

      // 2. Fetch the memory episode - it should still exist!
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/memory/${episodeId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.episode.id).toBe(episodeId);
      // decisionId has been set to null in database due to onDelete SetNull!
      expect(body.episode.decisionId).toBeNull();
    });
  });
});
