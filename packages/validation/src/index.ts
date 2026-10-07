import { z } from 'zod';

const logLevelSchema = z.enum(['error', 'warn', 'log', 'debug', 'verbose']);

function parseTrustProxy(value: string | undefined, context: z.RefinementCtx): false | number {
  if (value === undefined || value.trim() === '' || value.trim() === 'false') {
    return false;
  }

  const raw = value.trim();
  if (!/^[0-9]+$/.test(raw)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TRUST_PROXY must be false or a non-negative integer',
    });
    return z.NEVER;
  }

  return Number(raw);
}

const PRODUCTION_SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Exact development placeholders. Production must not boot with these values. */
const DEVELOPMENT_ONLY_SECRETS = new Set([
  'dev-only-change-me-ravion-access-secret',
  'dev-only-change-me-ravion-refresh-secret',
]);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(43111),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('7d'),
  DEFAULT_PUBLIC_TENANT_ID: z.string().uuid(),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:43110,http://127.0.0.1:43110'),
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  AUTH_THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_LOGIN_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_REGISTER_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_REFRESH_LIMIT: z.coerce.number().int().positive().default(30),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value, context): false | number => parseTrustProxy(value, context)),
  LOG_LEVEL: logLevelSchema.default('log'),
}).superRefine((env, context) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  for (const key of PRODUCTION_SECRET_KEYS) {
    if (DEVELOPMENT_ONLY_SECRETS.has(env[key])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must be configured with a production-safe value`,
      });
    }
  }
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
