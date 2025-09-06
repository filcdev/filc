import { camelKeys, replaceKeys } from 'string-ts';
import z from 'zod';

const MIN_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65_535;

const envSchema = z.object({
  CHRONOS_PORT: z.coerce.number().min(1).max(MAX_PORT).default(MIN_PORT),
  CHRONOS_MODE: z.enum(['development', 'production']).default('development'),
  CHRONOS_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warning', 'error'])
    .default('info'),
  CHRONOS_DATABASE_URL: z.url(),
  CHRONOS_AUTH_SECRET: z.base64().min(MIN_SECRET_LENGTH),
  CHRONOS_BASE_URL: z.url(),
  CHRONOS_ADMIN_EMAIL: z.email(),
});

const makeTypedEnvironment = <T>(schema: (v: unknown) => T) => {
  return (args: Record<string, unknown>) =>
    camelKeys(replaceKeys(schema({ ...args }), 'CHRONOS_', ''));
};

const getEnv = makeTypedEnvironment((v) => envSchema.parse(v));

export const env = getEnv(Bun.env);
