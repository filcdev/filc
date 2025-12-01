import { camelKeys, replaceKeys } from 'string-ts';
import z from 'zod';

const MIN_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3000;

const envSchema = z.object({
  CHRONOS_ADMIN_EMAIL: z.email(),
  CHRONOS_AUTH_SECRET: z.base64().min(MIN_SECRET_LENGTH),
  CHRONOS_BASE_URL: z.url(),
  CHRONOS_DATABASE_URL: z.url(),
  CHRONOS_ENTRA_CLIENT_ID: z.string(),
  CHRONOS_ENTRA_CLIENT_SECRET: z.string(),
  CHRONOS_ENTRA_TENANT_ID: z.string(),
  CHRONOS_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warning', 'error'])
    .default('info'),
  CHRONOS_MODE: z.enum(['development', 'production']).default('development'),
  CHRONOS_PORT: z.coerce
    .number()
    .min(MIN_PORT)
    .max(MAX_PORT)
    .default(DEFAULT_PORT),
  CHRONOS_REAL_IP_HEADER: z.string().optional(),
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
