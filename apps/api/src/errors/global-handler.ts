import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error';

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check if it is a known AppError
  if (error instanceof AppError) {
    request.log.warn({ err: error, url: request.url }, error.message);
    return reply.status(error.statusCode).send({
      success: false,
      error: error.name || 'AppError',
      message: error.message,
      errors: error.errors,
    });
  }

  // Handle Fastify Validation Errors (e.g. schema validation)
  if ('validation' in error && error.validation) {
    request.log.warn({ err: error, url: request.url }, 'Validation failed');
    return reply.status(400).send({
      success: false,
      error: 'ValidationError',
      message: 'Validation failed',
      errors: error.validation,
    });
  }

  // Default fallback for unhandled exceptions
  request.log.error({ err: error, url: request.url }, 'Unhandled error occurred');
  
  const isProd = process.env.NODE_ENV === 'production';
  return reply.status(500).send({
    success: false,
    error: 'InternalServerError',
    message: isProd ? 'An unexpected error occurred' : error.message,
    ...(isProd ? {} : { stack: error.stack }),
  });
}
