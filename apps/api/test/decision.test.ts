import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Decision Pipeline v1 Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-decision-${Date.now()}@example.com`;
  let userId = '';
  let authToken = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Decision Tester',
      },
    });
    userId = user.id;

    // Generate JWT
    authToken = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET);

    // Bootstrap rule parameters in database
    await app.prisma.rule.createMany({
      data: [
        {
          userId,
          name: 'Focus Rule',
          action: 'BATCH',
          conditionJson: JSON.stringify({
            operator: 'AND',
            conditions: [
              { field: 'focusLevel', operator: 'gt', value: 80 },
              { field: 'priority', operator: 'eq', value: 'low' },
            ],
          }),
        },
        {
          userId,
          name: 'Critical Rule',
          action: 'IMMEDIATE',
          conditionJson: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'priority', operator: 'eq', value: 'critical' }],
          }),
        },
        {
          userId,
          name: 'Meeting Rule',
          action: 'SILENT',
          conditionJson: JSON.stringify({
            operator: 'AND',
            conditions: [
              { field: 'workingMode', operator: 'eq', value: 'MEETING' },
              { field: 'category', operator: 'eq', value: 'social' },
            ],
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    // Cascade deletes decisions, events, rules
    await app.prisma.decision.deleteMany({
      where: { event: { userId } },
    });
    await app.prisma.event.deleteMany({
      where: { userId },
    });
    await app.prisma.rule.deleteMany({
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

  describe('Evaluate Decision Pipeline Outcomes', () => {
    it('should evaluate low priority notification as BATCH under high focus', async () => {
      // 1. Set Context Focus > 80
      await app.prisma.contextSnapshot.create({
        data: {
          userId,
          battery: 90,
          charging: false,
          activity: 'coding',
          timeOfDay: 'afternoon',
          visibility: 'visible',
          network: 'online',
          focusLevel: 85,
          workingMode: 'deep-work',
        },
      });

      // 2. Ingest low priority event
      const eventResponse = await app.prisma.event.create({
        data: {
          userId,
          source: 'Slack',
          sender: 'Bob',
          title: 'Lunch options',
          body: 'Do you want tacos or sushi?',
          category: 'social',
          priority: 'low',
        },
      });

      // 3. Run evaluation
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/decision/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { eventId: eventResponse.id },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.decision.decision).toBe('BATCH');
      expect(body.decision.signalsUsed).toContain('Focus Rule');
      expect(body.decision.explanation.narrative).toContain('Notification batched according to rule "Focus Rule"');
    });

    it('should evaluate critical notifications as IMMEDIATE regardless of focus level', async () => {
      // 1. Context remains high focus (85)
      // 2. Ingest critical event
      const eventResponse = await app.prisma.event.create({
        data: {
          userId,
          source: 'System',
          sender: 'PagerDuty',
          title: 'CRITICAL Failure',
          body: 'Production server is down!',
          category: 'urgent',
          priority: 'urgent', // maps to critical in PriorityCalculator
        },
      });

      // 3. Run evaluation
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/decision/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { eventId: eventResponse.id },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.decision.decision).toBe('IMMEDIATE');
      expect(body.decision.signalsUsed).toContain('Critical Rule');
      expect(body.decision.explanation.narrative).toContain('delivered immediately according to rule "Critical Rule"');
    });

    it('should evaluate social notifications as SILENT when user workingMode is MEETING', async () => {
      // 1. Update Context workingMode to MEETING
      await app.prisma.contextSnapshot.create({
        data: {
          userId,
          battery: 90,
          charging: false,
          activity: 'meeting',
          timeOfDay: 'afternoon',
          visibility: 'visible',
          network: 'online',
          focusLevel: 30,
          workingMode: 'MEETING',
        },
      });

      // 2. Ingest social event
      const eventResponse = await app.prisma.event.create({
        data: {
          userId,
          source: 'Slack',
          sender: 'Alice',
          title: 'Cat video',
          body: 'Look at this funny cat!',
          category: 'social',
          priority: 'medium',
        },
      });

      // 3. Run evaluation
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/decision/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { eventId: eventResponse.id },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.decision.decision).toBe('SILENT');
      expect(body.decision.signalsUsed).toContain('Meeting Rule');
      expect(body.decision.explanation.narrative).toContain('silenced according to rule "Meeting Rule"');
    });

    it('should fall back to IMMEDIATE for standard events matching no rules', async () => {
      // 1. Ingest standard development event (no active rules match dev/medium priority)
      const eventResponse = await app.prisma.event.create({
        data: {
          userId,
          source: 'GitHub',
          sender: 'CI',
          title: 'Build success',
          body: 'Main build passed',
          category: 'development',
          priority: 'medium',
        },
      });

      // 2. Run evaluation
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/decision/evaluate',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { eventId: eventResponse.id },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.decision.decision).toBe('IMMEDIATE');
      expect(body.decision.signalsUsed.length).toBe(0); // no rules matched
      expect(body.decision.explanation.narrative).toContain('delivered immediately because no active rules matched');
    });
  });

  describe('Decision History & Fetching By ID', () => {
    let checkDecisionId = '';

    it('should retrieve decision history with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/decision/history',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { page: '1', limit: '2' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(4);
      expect(body.items.length).toBe(2);
      
      checkDecisionId = body.items[0].id;
    });

    it('should retrieve a single decision detail by ID with explanation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/decision/${checkDecisionId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.decision.id).toBe(checkDecisionId);
      expect(body.decision.explanation).toBeDefined();
    });

    it('should return 404 for invalid decision ID format or missing UUID', async () => {
      const nonexistentUuid = 'd3b07384-d113-4ec5-a55d-e00000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/decision/${nonexistentUuid}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
