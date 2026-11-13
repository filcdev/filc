import { beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';

import { formatDateInTimeZone } from '@/utils/time-zone';

// The env schema parses at import time, so the required variables must exist
// before `@/utils/date` (which pulls in `@/utils/environment`) is evaluated.
// Static imports hoist, hence the dynamic import inside `beforeAll`.
// Deliberately not the default and not a CET host: proves env is consulted.
Object.assign(process.env, {
  CHRONOS_ADMIN_EMAIL: 'admin@example.com',
  CHRONOS_AUTH_SECRET: 'A'.repeat(44),
  CHRONOS_BASE_URL: 'http://localhost:3001',
  CHRONOS_DATABASE_URL: 'postgres://user:pass@localhost:5432/filc_test',
  CHRONOS_ENTRA_CLIENT_ID: 'client-id',
  CHRONOS_ENTRA_CLIENT_SECRET: 'client-secret',
  CHRONOS_ENTRA_TENANT_ID: 'tenant-id',
  CHRONOS_TIME_ZONE: 'America/New_York',
});

const TIME_ZONE_ERROR = /time zone/i;

let toDateOnlyString: (date: Date) => string;
let parseEnv: (args: Record<string, unknown>) => { timeZone: string };

beforeAll(async () => {
  // Importing `@/utils/environment` only loads zod, string-ts and the time-zone
  // leaf: no database connection and no network request is made.
  ({ toDateOnlyString } = await import('@/utils/date'));
  ({ parseEnv } = await import('@/utils/environment'));
});

describe('toDateOnlyString', () => {
  it('formats in the configured school timezone, not the host timezone', () => {
    const instant = new Date('2026-11-11T02:00:00Z');

    // 02:00Z is still the previous evening in New York; a host-local formatter
    // (UTC or CET, and the pre-fix implementation) returns the 11th here.
    expect(toDateOnlyString(instant)).toBe('2026-11-10');
    // The same instant in the default zone is the next day, so this documents
    // the divergence instead of restating the implementation.
    expect(formatDateInTimeZone(instant, 'Europe/Budapest')).toBe('2026-11-11');
  });
});

describe('CHRONOS_TIME_ZONE', () => {
  it('rejects a zone Intl does not know', () => {
    expect(() =>
      parseEnv({ ...process.env, CHRONOS_TIME_ZONE: 'Not/AZone' })
    ).toThrow(TIME_ZONE_ERROR);
  });

  it('falls back to the default zone when unset', () => {
    expect(
      parseEnv({ ...process.env, CHRONOS_TIME_ZONE: undefined }).timeZone
    ).toBe('Europe/Budapest');
  });
});
