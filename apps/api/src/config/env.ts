import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess((val) => parseInt(val as string, 10), z.number()).default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('supersecret-interrupt-iq-key-change-in-prod'),

  // Rate Limiting Configuration
  RATE_LIMIT_ENABLED: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
      if (typeof val === 'boolean') return val;
      return true;
    }, z.boolean())
    .default(true),
  RATE_LIMIT_GLOBAL_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(100),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(60000),
  RATE_LIMIT_AUTH_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(10),
  RATE_LIMIT_EVENTS_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(120),
  RATE_LIMIT_DECISION_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(60),
  RATE_LIMIT_RETRIEVAL_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(20),
  RATE_LIMIT_CRITIC_MAX: z
    .preprocess((val) => parseInt(val as string, 10), z.number().int().positive())
    .default(10),

  // Reverse proxy trust (false for direct access; true or CIDR string if behind trusted reverse proxy)
  TRUST_PROXY: z
    .preprocess(
      (val) => {
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false || val === undefined) return false;
        return val;
      },
      z.union([z.boolean(), z.string()])
    )
    .default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
