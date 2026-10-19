import path from 'node:path';

/**
 * Shared E2E environment, the single source for the ports, the Chronos env and
 * the session tokens. `playwright.config.ts` passes the Chronos env into its
 * `webServer`s and into the seed run via `globalSetup`; the specs import the
 * URLs. Nothing here may collide with the running dev stack (chronos 3001,
 * kiosk 5174, postgres 5432/55432).
 */
export const CHRONOS_PORT = 3002;
export const IRIS_PORT = 3210;
export const TEST_DB_PORT = 55_433;

export const TEST_DB_URL = `postgresql://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres`;

// Test-only secret; validated by the env schema as base64 of >= 32 bytes.
// better-auth signs session cookies with the raw string, so keep it verbatim.
export const TEST_AUTH_SECRET = 'ZmlsYy1lMmUtc2VjcmV0LXBsZWFzZS1pZ25vcmUtMzI=';

const baseEnv = {
  CHRONOS_ADMIN_EMAIL: 'admin@e2e.filc',
  CHRONOS_AUTH_SECRET: TEST_AUTH_SECRET,
  CHRONOS_BASE_URL: `http://localhost:${IRIS_PORT}`,
  CHRONOS_DATABASE_URL: TEST_DB_URL,
  CHRONOS_ENTRA_CLIENT_ID: 'e2e-client-id',
  CHRONOS_ENTRA_CLIENT_SECRET: 'e2e-client-secret',
  CHRONOS_ENTRA_TENANT_ID: 'e2e-tenant-id',
  CHRONOS_LOG_LEVEL: 'warning',
  CHRONOS_MODE: 'development',
};

/** Env for the booted Chronos API. */
export const chronosEnv = {
  ...baseEnv,
  CHRONOS_PORT: String(CHRONOS_PORT),
};

/** Env for the one-shot `db:seed:test` run. */
export const seedEnv = baseEnv;

export const chronosUrl = `http://localhost:${CHRONOS_PORT}`;
export const irisUrl = `http://localhost:${IRIS_PORT}`;

/** Session rows the seed script inserts; the storage states sign these. */
export const ADMIN_SESSION_TOKEN = 'e2e-admin-session-token';
export const USER_SESSION_TOKEN = 'e2e-user-session-token';

export const authDir = path.join('playwright', '.auth');
