import { camelKeys, replaceKeys } from 'string-ts';
import z from 'zod';

const MIN_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3001;

const boolean = z.preprocess((v) => {
  if (typeof v === 'string') {
    return v.toLowerCase() === 'true';
  }
  return Boolean(v);
}, z.boolean());

const envSchema = z.object({
  CHRONOS_ADMIN_EMAIL: z.email(),
  CHRONOS_AUTH_SECRET: z.base64().min(MIN_SECRET_LENGTH),
  CHRONOS_BASE_URL: z.url(),
  CHRONOS_DATABASE_URL: z.url(),
  CHRONOS_DRIZZLE_DEBUG: boolean.default(false),
  CHRONOS_ENTRA_CLIENT_ID: z.string(),
  CHRONOS_ENTRA_CLIENT_SECRET: z.string(),
  CHRONOS_ENTRA_TENANT_ID: z.string(),

  CHRONOS_FCM_CREDENTIALS: z.string().optional(),
  CHRONOS_FCM_PROJECT_ID: z.string().optional(),
  CHRONOS_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warning', 'error'])
    .default('info'),
  CHRONOS_MODE: z.enum(['development', 'production']).default('development'),
  CHRONOS_NOTIFICATION_DELAY_ANNOUNCEMENT: z.coerce.number().default(60),
  CHRONOS_NOTIFICATION_DELAY_BLOG_POST: z.coerce.number().default(60),
  CHRONOS_NOTIFICATION_DELAY_COHORT_RESELECTION_REQUIRED: z.coerce
    .number()
    .default(0),
  CHRONOS_NOTIFICATION_DELAY_MOVED_LESSON: z.coerce.number().default(60),

  CHRONOS_NOTIFICATION_DELAY_SUBSTITUTION: z.coerce.number().default(60),
  CHRONOS_NOTIFICATION_DELAY_SYSTEM_MESSAGE: z.coerce.number().default(60),
  CHRONOS_PORT: z.coerce
    .number()
    .min(MIN_PORT)
    .max(MAX_PORT)
    .default(DEFAULT_PORT),
  CHRONOS_REAL_IP_HEADER: z.string().optional(),
  CHRONOS_SENTRY_DSN: z.url().optional(),
  CHRONOS_SENTRY_ENVIRONMENT: z.string().optional(),
  CHRONOS_SENTRY_RELEASE: z.string().optional(),
  CHRONOS_SENTRY_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),
  CHRONOS_SENTRY_TRACES_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.1),
  CHRONOS_SMTP_FROM_EMAIL: z.string().optional(),
  CHRONOS_SMTP_FROM_NAME: z.string().optional(),

  CHRONOS_SMTP_HOST: z.string().optional(),
  CHRONOS_SMTP_PASS: z.string().optional(),
  CHRONOS_SMTP_PORT: z.coerce.number().default(587),
  CHRONOS_SMTP_SECURE: boolean.default(false),
  CHRONOS_SMTP_USER: z.string().optional(),
  CHRONOS_TRUSTED_ORIGINS: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()) : v),
    z.array(z.url()).optional()
  ),
});

const makeTypedEnvironment =
  <T>(schema: (v: unknown) => T) =>
  (args: Record<string, unknown>) =>
    camelKeys(replaceKeys(schema({ ...args }), 'CHRONOS_', ''));

const getEnv = makeTypedEnvironment((v) => envSchema.parse(v));

export const env = getEnv(Bun.env);
