import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/app-error';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token missing or invalid');
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    
    // Fetch user from DB to make sure they still exist
    const user = await request.server.prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedError('User not found or deactivated');
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
}
