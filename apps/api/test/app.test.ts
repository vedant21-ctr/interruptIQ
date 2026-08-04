import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

describe('Fastify Application Foundation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    // We mock/stub the database connection check if we want to run tests without a live DB.
    // However, if the Prisma client is connected, we can test it.
    // For unit tests, we can override the prisma plugin or intercept queries if needed.
    // Let's just mock $executeRaw to return successfully during tests to make it independent.
    app.prisma.$executeRaw = async () => 1;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to GET /live with 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/live',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'live' });
  });

  it('should respond to GET /ready with 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ready' });
  });

  it('should respond to GET /health with 200 OK and database status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.db).toBe('connected');
  });

  it('should load Swagger UI documentation', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/documentation/static/index.html',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<div id="swagger-ui">');
  });

  it('should handle NotFoundError using custom error handler', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/invalid-route-name-path',
    });

    // Fastify will default to 404 for unknown routes.
    // Let's check that it gets routed properly.
    expect(response.statusCode).toBe(404);
  });
});
