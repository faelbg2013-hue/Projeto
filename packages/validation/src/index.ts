import { z } from 'zod';

const logLevelSchema = z.enum(['error', 'warn', 'log', 'debug', 'verbose']);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(43111),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:43110,http://127.0.0.1:43110'),
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: logLevelSchema.default('log'),
});

export type Env = z.infer<typeof envSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export function validateEnv(input: Record<string, unknown>): Env {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}

export function isSwaggerEnabled(env: Pick<Env, 'NODE_ENV' | 'SWAGGER_ENABLED'>): boolean {
  if (env.SWAGGER_ENABLED === 'true') {
    return true;
  }

  if (env.SWAGGER_ENABLED === 'false') {
    return false;
  }

  return env.NODE_ENV !== 'production';
}
