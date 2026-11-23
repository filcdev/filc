import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setSystemTime,
} from 'bun:test';
import { and, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { cutoffLiteral } from '#utils/time-zone';

/**
 * The inbox list's WHERE chain, rendered with the real Postgres dialect. That
 * module is only imported for this pure predicate: its handlers are never run
 * here, so the database and the auth middleware are stubbed before the dynamic
 * import (a static one would bind the real modules).
 */

const USER_ID = '8f2f4f1e-9b3d-4c5a-8a7e-1d2c3b4a5f60';

const noop = () => undefined;

mock.module('@logtape/logtape', () => ({
  getLogger: () => ({
    debug: noop,
    error: noop,
    info: noop,
    trace: noop,
    warn: noop,
    warning: noop,
  }),
}));
/** The module reads its zone from the environment at import time. */
const TEST_TIME_ZONE = 'Europe/Budapest';
mock.module('#utils/environment', () => ({
  env: { enableTestNotifications: false, timeZone: TEST_TIME_ZONE },
}));
mock.module('#database', () => ({ db: {} }));
mock.module('#middleware/auth', () => ({
  requireAuthentication: noop,
  requireAuthorization: () => noop,
}));

const {
  createdBeforeToday,
  notificationListConditions,
  notificationReadColumn,
} = await import('#modules/notifications/notifications');

const dialect = new PgDialect();
const render = (expression: SQL) => dialect.sqlToQuery(expression);

/** The list's conditions as the one `and(...)` chain both queries apply. */
const renderWhere = (conditions: SQL[]) => {
  const where = and(...conditions);
  if (!where) {
    throw new Error(
      'the list always scopes to a user, so the chain is not empty'
    );
  }
  return render(where);
};

/**
 * The cutoff the builder is expected to pin: school midnight on the frozen
 * instant, written as the UTC wall clock a `timestamp` column compares against.
 * Derived from the configured zone, so a UTC cutoff is a different string.
 */
let cutoff = '';

beforeAll(() => {
  setSystemTime(new Date('2026-11-17T08:00:00Z'));
  cutoff = cutoffLiteral(new Date(), TEST_TIME_ZONE);
});

afterAll(() => {
  setSystemTime();
  mock.restore();
});

describe('notification list unread predicate', () => {
  it('filters unread rows to read = false and a row newer than the cutoff', () => {
    const { conditions } = notificationListConditions({
      unread: true,
      userId: USER_ID,
    });
    const query = renderWhere(conditions);

    // `not created_at < cutoff` is `created_at >= cutoff` for the non-null
    // timestamp column, and the whole unread clause has its own parentheses.
    expect(query.sql).toBe(
      '("notification"."user_id" = $1 and (("notification"."read" = $2 and not "notification"."created_at" < $3::timestamp)))'
    );
    expect(query.params).toEqual([USER_ID, false, cutoff]);
  });

  it('marks a row read when it is read or from a past day', () => {
    const query = render(notificationReadColumn(createdBeforeToday()));

    expect(query.sql).toBe(
      '(("notification"."read" or "notification"."created_at" < $1::timestamp))'
    );
    expect(query.params).toEqual([cutoff]);
  });

  it('keeps the user predicate outside the or group', () => {
    const { conditions } = notificationListConditions({
      unread: false,
      userId: USER_ID,
    });
    const query = renderWhere(conditions);

    // The `or` is the read filter of THIS user: the user id is joined with
    // `and` at the top level, never inside the parenthesised `or` group.
    expect(query.sql).toBe(
      '("notification"."user_id" = $1 and (("notification"."read" or "notification"."created_at" < $2::timestamp)))'
    );
    expect(query.params).toEqual([USER_ID, cutoff]);
  });
});
