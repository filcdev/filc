import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { userPreferences } from '#modules/notifications/schema';
import { teacher } from '#modules/timetable/schema';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '#utils/notifications/types';

/**
 * `handleUnsubscribe` reaches the database through `#database` at call time, so
 * the module is mocked before either the handler or the token helper is
 * imported. Both imports are dynamic for that reason: a static import would
 * bind the real module before the mock registers.
 */

const stored: {
  isTeacher: boolean;
  preferences: {
    notificationPreferences: Partial<NotificationPreferences>;
    userId: string;
  }[];
  writes: {
    notificationPreferences: NotificationPreferences;
    table: unknown;
    userId: string;
  }[];
} = { isTeacher: false, preferences: [], writes: [] };

const logs: {
  level: string;
  message: string;
  properties?: Record<string, unknown>;
}[] = [];

const recordLog =
  (level: string) =>
  (message: string, properties?: Record<string, unknown>): void => {
    logs.push({ level, message, properties });
  };

const fakeLogger = {
  debug: recordLog('debug'),
  error: recordLog('error'),
  fatal: recordLog('fatal'),
  info: recordLog('info'),
  trace: recordLog('trace'),
  warn: recordLog('warning'),
  warning: recordLog('warning'),
};

/** The two selects the handler runs: the stored row and the teacher link. */
const selectFrom = (table: unknown) => ({
  where: () => ({
    limit: () => {
      if (table === userPreferences) {
        return Promise.resolve(stored.preferences.slice(0, 1));
      }
      if (table === teacher && stored.isTeacher) {
        return Promise.resolve([{ id: 'teacher-1' }]);
      }
      return Promise.resolve([]);
    },
  }),
});

/**
 * `insert(...).values(...).onConflictDoUpdate(...)` against the unique
 * `user_id`: the fake upserts on that key, so a repeated call can only ever
 * leave one row, exactly as the real constraint does.
 */
const fakeDb = {
  insert: (table: unknown) => ({
    values: (values: {
      notificationPreferences: NotificationPreferences;
      userId: string;
    }) => {
      stored.writes.push({ ...values, table });
      return {
        onConflictDoUpdate: () => {
          const existing = stored.preferences.find(
            (row) => row.userId === values.userId
          );
          if (existing) {
            existing.notificationPreferences = values.notificationPreferences;
          } else {
            stored.preferences.push({ ...values });
          }
          return Promise.resolve();
        },
      };
    },
  }),
  select: () => ({ from: selectFrom }),
};

mock.module('@logtape/logtape', () => ({ getLogger: () => fakeLogger }));
mock.module('#database', () => ({ db: fakeDb }));
/**
 * The handler signs and renders its links through the SMTP provider, which
 * reads the environment at load time. Stub it so the file runs without a local
 * `.env`.
 */
mock.module('#utils/environment', () => ({
  env: {
    authSecret: 'test-unsubscribe-secret',
    baseUrl: 'https://filc.test',
    mailTransport: 'smtp',
    smtpAuth: 'basic',
  },
}));

const { handleUnsubscribe } = await import(
  '#modules/notifications/unsubscribe-html'
);
const { generateUnsubscribeToken } = await import(
  '#utils/notifications/providers/smtp'
);

const USER_ID = '8f2f4f1e-9b3d-4c5a-8a7e-1d2c3b4a5f60';

const unsubscribeRequest = (token: string) =>
  new Request('https://filc.test/api/notifications/unsubscribe', {
    body: new URLSearchParams({ token, userId: USER_ID }),
    method: 'POST',
  });

const isHtml = (response: Response) =>
  response.headers.get('content-type')?.includes('text/html') ?? false;

beforeEach(() => {
  logs.length = 0;
  stored.isTeacher = false;
  stored.preferences.length = 0;
  stored.writes.length = 0;
});

afterAll(() => {
  mock.restore();
});

describe('handleUnsubscribe', () => {
  it('rejects a wrong token with 400 and logs the request id', async () => {
    const token = '0'.repeat(64);
    expect(token).not.toBe(generateUnsubscribeToken(USER_ID));

    const response = await handleUnsubscribe(
      unsubscribeRequest(token),
      'req-wrong-token'
    );

    expect(response.status).toBe(400);
    expect(isHtml(response)).toBe(true);
    expect(await response.text()).toContain('Érvénytelen');

    const warnings = logs.filter((entry) => entry.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.properties?.requestId).toBe('req-wrong-token');
    expect(stored.writes).toHaveLength(0);
  });

  it('rejects a token of the wrong length without comparing, and logs it', async () => {
    // 63 hex characters: the schema rejects it, so `timingSafeEqual` is never
    // reached (it throws on a length mismatch).
    const response = await handleUnsubscribe(
      unsubscribeRequest('0'.repeat(63)),
      'req-wrong-length'
    );

    expect(response.status).toBe(400);
    expect(isHtml(response)).toBe(true);
    expect(await response.text()).toContain('Érvénytelen');

    const warnings = logs.filter((entry) => entry.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.properties?.requestId).toBe('req-wrong-length');
    expect(stored.writes).toHaveLength(0);
  });

  it('writes one preferences update for the right user on a valid token', async () => {
    stored.preferences.push({
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      userId: USER_ID,
    });

    const response = await handleUnsubscribe(
      unsubscribeRequest(generateUnsubscribeToken(USER_ID)),
      'req-valid'
    );

    expect(response.status).toBe(200);
    expect(isHtml(response)).toBe(true);
    expect(await response.text()).toContain('Sikeres');

    expect(stored.writes).toHaveLength(1);
    const [write] = stored.writes;
    expect(write?.table).toBe(userPreferences);
    expect(write?.userId).toBe(USER_ID);
    expect(write?.notificationPreferences.emailEnabled).toBe(false);
    expect(stored.preferences).toHaveLength(1);
  });

  it('turns email off on a legacy channelsEnabled:false row and keeps the rest', async () => {
    stored.preferences.push({
      notificationPreferences: {
        blogPost: true,
        channelsEnabled: false,
        substitution: false,
      },
      userId: USER_ID,
    });

    await handleUnsubscribe(
      unsubscribeRequest(generateUnsubscribeToken(USER_ID)),
      'req-legacy'
    );

    const [write] = stored.writes;
    const preferences =
      write?.notificationPreferences as NotificationPreferences;
    expect(write?.userId).toBe(USER_ID);
    expect(preferences.emailEnabled).toBe(false);
    // The stored per-type choices survive; the legacy master switch is raised
    // to the current shape without reviving email.
    expect(preferences.blogPost).toBe(true);
    expect(preferences.substitution).toBe(false);
    expect(preferences.systemMessage).toBe(true);
    expect(preferences.channelsEnabled).toBe(true);
  });

  it('is idempotent: the same token twice leaves one row and succeeds twice', async () => {
    const token = generateUnsubscribeToken(USER_ID);

    const first = await handleUnsubscribe(
      unsubscribeRequest(token),
      'req-first'
    );
    const second = await handleUnsubscribe(
      unsubscribeRequest(token),
      'req-second'
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(stored.writes).toHaveLength(2);
    expect(stored.writes[0]?.notificationPreferences).toEqual(
      stored.writes[1]?.notificationPreferences
    );
    // The upsert targets the unique user id, so the row is updated in place.
    expect(stored.preferences).toHaveLength(1);
    expect(stored.preferences[0]?.notificationPreferences.emailEnabled).toBe(
      false
    );
  });
});
