# Production Deployment Guide

InterruptIQ is containerized and ready for production deployment using Docker.

## Configuration Checklist
Ensure the following host environment variables are set in production:
* `DATABASE_URL`: Production PostgreSQL database cluster connection string.
* `JWT_SECRET`: A high-entropy secret string to cryptographically sign user session keys.

## Deployment with Docker Compose
To run in production mode:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Security Considerations
* Disable Swagger UI paths in production (can be configured in `apps/api/src/app.ts` under swagger UI config using `env.NODE_ENV` checks).
* Maintain Database backups using volume mounts.
