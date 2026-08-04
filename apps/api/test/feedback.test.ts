import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Feedback Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-feedback-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';
  let decisionId = '';
  let feedbackId = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Feedback Tester',
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
        sender: 'Charlie',
        title: 'Meeting sync',
        body: 'Sync in 5 mins',
        category: 'social',
        priority: 'medium',
      },
    });

    const decision = await app.prisma.decision.create({
      data: {
        eventId: event.id,
        decision: 'BATCH',
        reason: 'Focus mode is active',
        confidence: 0.9,
      },
    });
    decisionId = decision.id;
  });

  afterAll(async () => {
    // Cascade deletes feedbacks, decisions, events
    await app.prisma.feedback.deleteMany({
      where: { decision: { event: { userId } } },
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
        url: '/api/v1/feedback',
        payload: { decisionId, userAction: 'ACCEPTED' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Feedback Lifecycle & Analytics', () => {
    it('should create feedback successfully for a valid decision', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId,
          userAction: 'ACCEPTED',
          comment: 'Perfect timing',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.feedback.id).toBeDefined();
      expect(body.feedback.originalDecision).toBe('BATCH');
      expect(body.feedback.userAction).toBe('ACCEPTED');
      expect(body.feedback.comment).toBe('Perfect timing');

      feedbackId = body.feedback.id;
    });

    it('should allow multiple feedback entries for a single decision', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId,
          userAction: 'OVERRIDDEN',
          comment: 'Actually needed this now',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.feedback.userAction).toBe('OVERRIDDEN');
    });

    it('should reject feedback for nonexistent decisions with 404', async () => {
      const nonexistentUuid = 'e8b7c71d-55db-44a6-993d-d00000000000';
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId: nonexistentUuid,
          userAction: 'DISMISSED',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fetch feedback details by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/feedback/${feedbackId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.feedback.id).toBe(feedbackId);
      expect(body.feedback.comment).toBe('Perfect timing');
    });

    it('should calculate analytics ratios correctly', async () => {
      // Current feedbacks:
      // 1. ACCEPTED
      // 2. OVERRIDDEN
      // Let's create a 3rd one: DISMISSED to have diverse analytics
      await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          decisionId,
          userAction: 'DISMISSED',
        },
      });

      // Total feedbacks = 3.
      // ACCEPTED = 1/3 (0.33)
      // OVERRIDDEN = 1/3 (0.33)
      // DISMISSED = 1/3 (0.33)

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feedback',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.analytics.totalFeedbacks).toBe(3);
      expect(body.analytics.acceptanceRate).toBeCloseTo(0.333, 2);
      expect(body.analytics.overrideRate).toBeCloseTo(0.333, 2);
      expect(body.analytics.dismissRate).toBeCloseTo(0.333, 2);
    });
  });
});
