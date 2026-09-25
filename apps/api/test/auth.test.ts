import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

import { isDatabaseAvailable } from './test-db';

describe('Authentication & User Profile Integration', () => {
  let app: FastifyInstance;
  const testEmail = `test-auth-${Date.now()}@example.com`;
  const testPassword = 'superpassword123';
  const testName = 'Test User';
  let authToken = '';
  let dbAvailable = false;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    
    dbAvailable = await isDatabaseAvailable(app.prisma);
    if (!dbAvailable) return;

    // Ensure test user does not exist
    await app.prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    if (dbAvailable) {
      // Clean up test user
      await app.prisma.user.deleteMany({
        where: { email: testEmail },
      });
    }
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it.skipIf(!dbAvailable)('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe(testEmail);
      expect(body.user.name).toBe(testName);
      expect(body.user.id).toBeDefined();
      
      // Store token for subsequent tests
      authToken = body.token;
    });

    it.skipIf(!dbAvailable)('should reject registration with duplicate email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Another Name',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('already registered');
    });

    it('should validate inputs using zod schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: '123', // less than 6 chars
          name: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it.skipIf(!dbAvailable)('should authenticate user and return a token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe(testEmail);
    });

    it.skipIf(!dbAvailable)('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Protected Routes & Profile Management', () => {
    it('should reject profile request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it.skipIf(!dbAvailable)('should fetch profile with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.user.email).toBe(testEmail);
      expect(body.user.name).toBe(testName);
    });

    it.skipIf(!dbAvailable)('should update profile name via PATCH /me', async () => {
      const updatedName = 'Updated Test Name';
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: updatedName,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.user.name).toBe(updatedName);

      // Verify DB update
      const getResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.user.name).toBe(updatedName);
    });
  });
});
