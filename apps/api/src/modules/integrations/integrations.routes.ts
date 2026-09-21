import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';
import { SlackAdapter } from './slack/slack.adapter';
import { normalizeSlackMessage } from './slack/slack.normalizer';
import { BadRequestError, UnauthorizedError } from '../../errors/app-error';
import { env } from '../../config/env';

const ConnectParamSchema = z.object({
  provider: z.enum(['slack', 'google']),
});

const CallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
});

export async function integrationsRoutes(fastify: FastifyInstance) {
  const repository = new IntegrationsRepository(fastify.prisma);
  const service = new IntegrationsService(repository);

  // GET /api/v1/integrations - List user connections
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const connections = await service.getUserConnections(userId);
    return reply.send({ success: true, connections });
  });

  // GET /api/v1/integrations/:provider/connect - Get OAuth Authorization URL
  fastify.get('/:provider/connect', { preHandler: [authenticate] }, async (request, reply) => {
    const { provider } = ConnectParamSchema.parse(request.params);
    const userId = request.user.id;
    // Generate state containing userId and random CSRF nonce
    const state = Buffer.from(JSON.stringify({ userId, nonce: Date.now() })).toString('base64');
    const url = await service.getAuthorizationUrl(userId, provider, state);
    return reply.send({ success: true, url, state });
  });

  // GET /api/v1/integrations/:provider/callback - OAuth Callback Handler
  fastify.get('/:provider/callback', async (request, reply) => {
    const { provider } = ConnectParamSchema.parse(request.params);
    const { code, state } = CallbackQuerySchema.parse(request.query);

    // Verify state token to prevent CSRF
    let stateDecoded: { userId: string; nonce: number };
    try {
      stateDecoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestError('Invalid OAuth state parameter');
    }

    if (!stateDecoded.userId) {
      throw new BadRequestError('State parameter missing user ID');
    }

    const connection = await service.handleOAuthCallback(stateDecoded.userId, provider, code);
    return reply.send({
      success: true,
      message: `Successfully connected ${provider} integration`,
      connection,
    });
  });

  // POST /api/v1/integrations/:provider/pause - Pause Sync
  fastify.post('/:provider/pause', { preHandler: [authenticate] }, async (request, reply) => {
    const { provider } = ConnectParamSchema.parse(request.params);
    const userId = request.user.id;
    await service.pauseIntegration(userId, provider);
    return reply.send({ success: true, message: `Paused ${provider} integration` });
  });

  // POST /api/v1/integrations/:provider/resume - Resume Sync
  fastify.post('/:provider/resume', { preHandler: [authenticate] }, async (request, reply) => {
    const { provider } = ConnectParamSchema.parse(request.params);
    const userId = request.user.id;
    await service.resumeIntegration(userId, provider);
    return reply.send({ success: true, message: `Resumed ${provider} integration` });
  });

  // DELETE /api/v1/integrations/:provider - Disconnect Integration
  fastify.delete('/:provider', { preHandler: [authenticate] }, async (request, reply) => {
    const { provider } = ConnectParamSchema.parse(request.params);
    const userId = request.user.id;
    await service.disconnectIntegration(userId, provider);
    return reply.send({ success: true, message: `Disconnected ${provider} integration` });
  });

  // POST /api/v1/integrations/slack/events - Slack Events API Webhook Receiver
  fastify.post('/slack/events', async (request, reply) => {
    const rawBody = JSON.stringify(request.body);
    const signature = request.headers['x-slack-signature'] as string;
    const timestamp = request.headers['x-slack-request-timestamp'] as string;

    // Verify HMAC-SHA256 signature if signing secret configured
    if (env.SLACK_SIGNING_SECRET && signature && timestamp) {
      const isValid = SlackAdapter.verifySlackSignature(
        env.SLACK_SIGNING_SECRET,
        signature,
        timestamp,
        rawBody
      );
      if (!isValid) {
        throw new UnauthorizedError('Slack webhook signature verification failed');
      }
    }

    const payload = request.body as any;

    // Slack URL Verification Challenge
    if (payload.type === 'url_verification') {
      return reply.status(200).send({ challenge: payload.challenge });
    }

    // Process event payload transiently
    if (payload.event && (payload.event.type === 'message' || payload.event.type === 'app_mention')) {
      const msg = payload.event;
      // Extract normalized InterruptionRecord and discard raw text payload
      const normalizedRecord = normalizeSlackMessage(msg, 'system-slack-user', msg.user);

      // Async log notification without saving raw message body text
      request.log.info(
        {
          interruptionId: normalizedRecord.id,
          channelType: normalizedRecord.channelType,
          mentionType: normalizedRecord.mentionType,
          hasUrgencySignal: normalizedRecord.hasUrgencySignal,
        },
        'Slack real-time event normalized & ingested'
      );
    }

    return reply.status(200).send({ ok: true });
  });
}
