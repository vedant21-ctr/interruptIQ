import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../errors/app-error';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(1, 'Name is required'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/register
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = RegisterSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const { email, password, name } = bodyParsed.data;

      // Check if user already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new BadRequestError('Email already registered');
      }

      // Hash password using bcryptjs
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user and credentials account in a transaction
      const user = await fastify.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
          },
        });

        await tx.account.create({
          data: {
            userId: newUser.id,
            accountId: email,
            providerId: 'credential',
            password: hashedPassword,
          },
        });

        return newUser;
      });

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return reply.status(201).send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }
  );

  // POST /api/v1/auth/login
  fastify.post(
    '/login',
    {
      schema: {
        description: 'Authenticate user credentials and return JWT access token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodyParsed = LoginSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new BadRequestError('Validation failed', bodyParsed.error.format());
      }

      const { email, password } = bodyParsed.data;

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Find credential account
      const account = await fastify.prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: 'credential',
        },
      });

      if (!account || !account.password) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Compare password
      const passwordMatch = await bcrypt.compare(password, account.password);
      if (!passwordMatch) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return reply.status(200).send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }
  );

  // POST /api/v1/auth/logout
  fastify.post(
    '/logout',
    {
      schema: {
        description: 'Logout current session',
        tags: ['Authentication'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // In a stateless JWT architecture, logout is typically handled client-side by destroying the token.
      // We return success: true to acknowledge the request.
      return reply.status(200).send({
        success: true,
        message: 'Logged out successfully',
      });
    }
  );
}
