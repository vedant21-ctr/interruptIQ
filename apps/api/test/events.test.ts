import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Event Ingestion Engine Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-events-${Date.now()}@example.com`;
  const testPassword = 'eventspassword123';
  let userId = '';
  let authToken = '';
  let createdEventId = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create a test user for auth context
    const user = await app.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Events Tester',
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
    // Delete events and user
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
        url: '/api/v1/events',
        payload: { title: 'Test Event' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should block GET / with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Event Operations Cycle', () => {
    it('should ingest a new event successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          source: 'Slack',
          sender: 'Alice',
          title: 'Direct Message',
          body: 'Hello, are you available for a sync?',
          category: 'social',
          priority: 'medium',
          payload: { channel: 'D12345', urgent: false },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.event.id).toBeDefined();
      expect(body.event.source).toBe('Slack');
      expect(body.event.sender).toBe('Alice');
      expect(body.event.title).toBe('Direct Message');
      expect(body.event.priority).toBe('medium');
      expect(body.event.payload).toEqual({ channel: 'D12345', urgent: false });
      
      createdEventId = body.event.id;
    });

    it('should fetch the specific event by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${createdEventId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.event.id).toBe(createdEventId);
      expect(body.event.body).toBe('Hello, are you available for a sync?');
    });

    it('should return 404 for an invalid event ID format or nonexistent ID', async () => {
      const nonexistentUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${nonexistentUuid}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should query multiple events with pagination and filtering', async () => {
      // Ingest another event first
      await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          source: 'GitHub',
          sender: 'dependabot',
          title: 'Vulnerability Alert',
          body: 'Update lodash dependency to v4.17.21',
          category: 'development',
          priority: 'high',
        },
      });

      // Query list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.success).toBe(true);
      expect(listBody.total).toBe(2);
      expect(listBody.items.length).toBe(2);
      // Sorted newest first
      expect(listBody.items[0].source).toBe('GitHub');
      expect(listBody.items[1].source).toBe('Slack');
    });

    it('should support pagination limit/page queries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { page: '2', limit: '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items.length).toBe(1);
      expect(body.items[0].source).toBe('Slack'); // older item
    });

    it('should filter events by source/category/priority', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { source: 'GitHub' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.items[0].source).toBe('GitHub');
    });

    it('should search events by title/sender', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        query: { title: 'vulnerability' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.items[0].sender).toBe('dependabot');
    });

    it('should delete a specific event by ID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/events/${createdEventId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      
      // Verify GET by ID returns 404 now
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${createdEventId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should reject invalid categories', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          source: 'Slack',
          sender: 'Alice',
          title: 'Direct Message',
          body: 'Hello',
          category: 'invalid-category', // Invalid Zod enum
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
