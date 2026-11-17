import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { callbackUrlWithRedirect, resolveReturnTo } from './auth-redirect';

const ORIGIN = 'http://localhost:3000';

// `callbackUrlWithRedirect` reads the live origin; there is no `window` under
// `bun test`, so the two tests that need it install the narrowest stub.
beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: ORIGIN } },
  });
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

describe('resolveReturnTo', () => {
  test('keeps the root path', () => {
    expect(resolveReturnTo('/')).toBe('/');
  });

  test('keeps the path, the search and the fragment', () => {
    expect(resolveReturnTo('/settings/notifications?channel=email#x')).toBe(
      '/settings/notifications?channel=email#x'
    );
  });

  const rejected = [
    ['a relative path', '1'],
    ['a protocol-relative URL', '//evil.test'],
    ['a backslash-escaped host', '/\\evil.test'],
    ['a tab-escaped host', '/\t/evil.test'],
    ['an absolute URL', 'https://evil.test'],
    ['an empty string', ''],
  ] as const;

  for (const [label, redirect] of rejected) {
    test(`falls back to / for ${label}`, () => {
      expect(resolveReturnTo(redirect)).toBe('/');
    });
  }

  test('falls back to / when no redirect was carried', () => {
    expect(resolveReturnTo(undefined)).toBe('/');
  });
});

describe('callbackUrlWithRedirect', () => {
  test('drops the fragment and keeps the path and search', () => {
    expect(
      callbackUrlWithRedirect(
        '/auth/welcome',
        '/settings/notifications?channel=email#x'
      )
    ).toBe(
      `${ORIGIN}/auth/welcome?redirect=%2Fsettings%2Fnotifications%3Fchannel%3Demail`
    );
  });

  test('adds no redirect parameter for the default destination', () => {
    expect(callbackUrlWithRedirect('/auth/error', '/')).toBe(
      `${ORIGIN}/auth/error`
    );
  });

  test('falls back to the default destination for a malformed return path', () => {
    // An unparseable host throws in `new URL`; the callback URL must survive.
    expect(callbackUrlWithRedirect('/auth/error', '//[::1')).toBe(
      `${ORIGIN}/auth/error`
    );
  });
});
