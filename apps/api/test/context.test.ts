import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Context Intelligence Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-context-${Date.now()}@example.com`;
  const testPassword = 'contextpassword123';
  let userId = '';
  let authToken = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user for auth context
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Context Tester',
      },
    });
    userId = user.id;

    // Generate JWT
    authToken = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET
    );
  });

  afterAll(async () => {
    // Delete snapshots and user
    await app.prisma.contextSnapshot.deleteMany({
      where: { userId },
    });
    await app.prisma.user.delete({
      where: { id: userId },
    });
    await app.close();
  });

  describe('Unauthenticated Access Control', () => {
    it('should block GET /current with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/context/current',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should block PATCH /current with 401', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/context/current',
        payload: { battery: 50 },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Context Operation Life Cycle', () => {
    it('should return 404 if no context snapshots exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should create initial context snapshot on PATCH and populate defaults', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          battery: 88,
          charging: true,
          activity: 'coding',
          currentTask: 'Writing integration tests',
          focusLevel: 95,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.context.battery).toBe(88);
      expect(body.context.charging).toBe(true);
      expect(body.context.activity).toBe('coding');
      expect(body.context.currentTask).toBe('Writing integration tests');
      expect(body.context.focusLevel).toBe(95);
      
      // Defaults filled in
      expect(body.context.network).toBe('online');
      expect(body.context.workingMode).toBeNull();
    });

    it('should fetch the current latest context snapshot', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.context.battery).toBe(88);
    });

    it('should create a new snapshot on PATCH merging fields with the latest snapshot', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          battery: 87, // Changed battery
          focusLevel: 90, // Changed focus level
          workingMode: 'deep-work', // New field updated
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.context.battery).toBe(87);
      expect(body.context.focusLevel).toBe(90);
      expect(body.context.workingMode).toBe('deep-work');
      
      // Retained fields from previous snapshot
      expect(body.context.activity).toBe('coding');
      expect(body.context.currentTask).toBe('Writing integration tests');
    });

    it('should return context history sorted newest first with total count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/context/history',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { page: '1', limit: '10' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBe(2);
      expect(body.items.length).toBe(2);
      // Newest snapshot first (battery: 87, then battery: 88)
      expect(body.items[0].battery).toBe(87);
      expect(body.items[1].battery).toBe(88);
    });

    it('should enforce pagination page and limit parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/context/history',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { page: '2', limit: '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(body.items.length).toBe(1);
      expect(body.items[0].battery).toBe(88); // Second item (older one)
    });

    it('should delete the current latest context snapshot and return to previous', async () => {
      // Delete latest (battery 87)
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(deleteResponse.statusCode).toBe(200);
      const deleteBody = JSON.parse(deleteResponse.body);
      expect(deleteBody.success).toBe(true);
      expect(deleteBody.context.battery).toBe(87);

      // Current should now fall back to the initial one (battery 88)
      const currentResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(currentResponse.statusCode).toBe(200);
      const currentBody = JSON.parse(currentResponse.body);
      expect(currentBody.context.battery).toBe(88);
    });

    it('should reject invalid validation data types', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/context/current',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          battery: 'not-a-number',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
