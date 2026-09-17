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

const envShape = z.object({
  CHRONOS_ADMIN_EMAIL: z.email(),
  CHRONOS_AUTH_SECRET: z.base64().min(MIN_SECRET_LENGTH),
  CHRONOS_BASE_URL: z.url(),
  CHRONOS_BKK_API_KEY: z.string().optional(),
  CHRONOS_DATABASE_URL: z.url(),
  CHRONOS_DRIZZLE_DEBUG: boolean.default(false),
  CHRONOS_ENTRA_CLIENT_ID: z.string(),
  CHRONOS_ENTRA_CLIENT_SECRET: z.string().optional(),
  CHRONOS_ENTRA_TENANT_ID: z.string(),

  CHRONOS_FCM_CREDENTIALS: z.string().optional(),
  CHRONOS_FCM_PROJECT_ID: z.string().optional(),
  CHRONOS_FREERADIUS_IP: z.string().optional(),
  CHRONOS_FREERADIUS_SHARED_SECRET: z.string().optional(),
  CHRONOS_KIOSK_WEATHER_LOCATION: z
    .string()
    .default('47.50535837979173,19.090123083749727'),
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
  CHRONOS_OAUTH_PROXY_SECRET: z.string().optional(),
  // OAuth proxy: lets preview deployments sign in through the production
  // origin, because Entra rejects wildcard redirect URIs. Both must be set for
  // the plugin to be registered; see docs/entra-setup.md.
  CHRONOS_OAUTH_PROXY_URL: z.url().optional(),
  CHRONOS_PORT: z.coerce
    .number()
    .min(MIN_PORT)
    .max(MAX_PORT)
    .default(DEFAULT_PORT),
  CHRONOS_RATE_LIMIT_COOKIE_NAME: z.string().default('filc_rl_id'),
  CHRONOS_RATE_LIMIT_MAX: z.coerce.number().default(180),
  CHRONOS_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(30_000),
  CHRONOS_REAL_IP_HEADER: z.string().optional(),

  CHRONOS_S3_ACCESS_KEY_ID: z.string().optional(),
  CHRONOS_S3_BUCKET: z.string().optional(),
  CHRONOS_S3_ENDPOINT: z.url().optional(),
  CHRONOS_S3_REGION: z.string().default('garage'),
  CHRONOS_S3_SECRET_ACCESS_KEY: z.string().optional(),
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
  CHRONOS_WIFI_CA_CERT_PATH: z.string().optional(),
  CHRONOS_WIFI_CONTROLLER_PROVIDER: z.enum(['none', 'unifi']).default('none'),
  CHRONOS_WIFI_ENABLED: boolean.default(true),
  CHRONOS_WIFI_ENCRYPTION_SECRET: z.string().optional(),
  CHRONOS_WIFI_SSID: z.string().optional(),
  UNIFI_HOST: z.string().optional(),
  UNIFI_INSECURE_TLS: boolean.default(false),
  UNIFI_PASSWORD: z.string().optional(),
  UNIFI_PORT: z.coerce.number().min(MIN_PORT).max(MAX_PORT).default(8443),
  UNIFI_USERNAME: z.string().optional(),
  CHRONOS_WEATHER_API_KEY: z.string().optional(),
});

const envSchema = envShape.refine(
  // A proxied environment (a preview) redirects to the proxy origin, which
  // exchanges the code and hands the profile back, so it never calls Entra's
  // token endpoint. Everyone else terminates the flow and needs a secret.
  (value) => {
    if (value.CHRONOS_ENTRA_CLIENT_SECRET !== undefined) {
      return true;
    }

    const {
      CHRONOS_OAUTH_PROXY_SECRET: proxySecret,
      CHRONOS_OAUTH_PROXY_URL: proxyUrl,
    } = value;

    // The proxy origin is not proxied: both origins match, better-auth stands
    // the plugin down there, and that environment exchanges codes itself.
    return (
      proxyUrl !== undefined &&
      proxySecret !== undefined &&
      new URL(proxyUrl).origin !== new URL(value.CHRONOS_BASE_URL).origin
    );
  },
  {
    message: 'Required unless CHRONOS_OAUTH_PROXY_URL points at another origin',
    path: ['CHRONOS_ENTRA_CLIENT_SECRET'],
  }
);

const makeTypedEnvironment =
  <T>(schema: (v: unknown) => T) =>
  (args: Record<string, unknown>) =>
    camelKeys(replaceKeys(schema({ ...args }), 'CHRONOS_', ''));

const getEnv = makeTypedEnvironment((v) => envSchema.parse(v));

export const env = getEnv(Bun.env);
