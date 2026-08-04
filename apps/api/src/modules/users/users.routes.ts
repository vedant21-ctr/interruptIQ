import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware';
import { BadRequestError } from '../../errors/app-error';

const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  image: z.string().url('Image must be a valid URL').optional().nullable(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  // Protect all routes in this plugin before schema validation
  fastify.addHook('preValidation', authenticate);

  // GET /api/v1/users/me
  fastify.get(
    '/me',
    {
      schema: {
        description: 'Get details of the currently authenticated user profile',
        tags: ['Users'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  image: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.status(200).send({
        success: true,
        user,
      });
    }
  );

  // PATCH /api/v1/users/me
  fastify.patch(
    '/me',
    {
      schema: {
        description: 'Update the profile of the currently authenticated user',
        tags: ['Users'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            image: { type: 'string', format: 'uri', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  image: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = UpdateProfileSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const updateData = bodyParsed.data;

      const updatedUser = await fastify.prisma.user.update({
        where: { id: request.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      });

      return reply.status(200).send({
        success: true,
        user: updatedUser,
      });
    }
  );
}
