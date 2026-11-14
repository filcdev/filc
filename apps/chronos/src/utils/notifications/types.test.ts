import { describe, expect, it } from 'bun:test';
import {
  applyPreferencesPatch,
  completePreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '#utils/notifications/types';

/** The pre-split unsubscribe state: the master switch off, no channel keys. */
const LEGACY_OFF = { channelsEnabled: false };

describe('completePreferences', () => {
  it('reads a legacy channelsEnabled:false row as every channel off', () => {
    const prefs = completePreferences(LEGACY_OFF);

    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.pushEnabled).toBe(false);
    // The legacy switch is migrated on read; the per-type flags keep their
    // defaults.
    expect(prefs.channelsEnabled).toBe(true);
    expect(prefs.substitution).toBe(true);
    expect(prefs.blogPost).toBe(false);
  });

  it('fills a row missing keys from the defaults', () => {
    expect(completePreferences(undefined)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    expect(completePreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);

    const partial = completePreferences({ announcement: false });
    expect(partial.announcement).toBe(false);
    expect(partial.emailEnabled).toBe(true);
    expect(partial.pushEnabled).toBe(true);
  });

  it('keeps a modern row as stored', () => {
    const stored: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
      pushEnabled: true,
      substitution: false,
    };

    expect(completePreferences(stored)).toEqual(stored);
  });

  it('applies the role default only to a channel the row does not name', () => {
    const prefs = completePreferences(undefined, { email: false });

    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.pushEnabled).toBe(true);
  });

  it('lets an explicit channel value beat the role default', () => {
    const prefs = completePreferences({ emailEnabled: true }, { email: false });

    expect(prefs.emailEnabled).toBe(true);
  });

  it('lets the legacy channelsEnabled:false master switch beat every role default', () => {
    const prefs = completePreferences(LEGACY_OFF, {
      email: true,
      push: true,
    });

    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.pushEnabled).toBe(false);
  });
});

describe('applyPreferencesPatch', () => {
  const legacyOff = completePreferences(LEGACY_OFF);

  it('leaves a legacy row off when the patch names only a type flag', () => {
    const next = applyPreferencesPatch(legacyOff, { substitution: false });

    expect(next.substitution).toBe(false);
    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(false);
    expect(next.channelsEnabled).toBe(true);
  });

  it('turns only the channel the patch names on', () => {
    const next = applyPreferencesPatch(legacyOff, { emailEnabled: true });

    expect(next.emailEnabled).toBe(true);
    expect(next.pushEnabled).toBe(false);
    expect(next.announcement).toBe(true);
  });

  it('keeps the channels a modern row already had', () => {
    const modern = completePreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
      pushEnabled: false,
    });

    const next = applyPreferencesPatch(modern, { blogPost: true });

    expect(next.blogPost).toBe(true);
    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(false);
  });

  it('honours an explicit channel value over the resolved base', () => {
    const next = applyPreferencesPatch(legacyOff, {
      emailEnabled: false,
      pushEnabled: true,
    });

    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(true);
    expect(next.channelsEnabled).toBe(true);
  });

  // `defaults` decides a channel only when the base does not name it, so this
  // uses a raw row with no channel keys and a role default of `email: false`:
  // the assertion fails if the argument stops being forwarded and email falls
  // back to the global `true` instead.
  it('forwards the role defaults for a base that names no channel key', () => {
    const student = applyPreferencesPatch(
      { announcement: true },
      { announcement: false },
      { email: false }
    );

    expect(student.announcement).toBe(false);
    expect(student.emailEnabled).toBe(false);
    expect(student.pushEnabled).toBe(true);
  });

  // The unsubscribe page writes exactly this: the stored row completed, then
  // only email turned off.
  it('turns only email off for the unsubscribe write', () => {
    const fromLegacy = applyPreferencesPatch(completePreferences(LEGACY_OFF), {
      emailEnabled: false,
    });

    expect(fromLegacy.emailEnabled).toBe(false);
    expect(fromLegacy.pushEnabled).toBe(false);
    expect(fromLegacy.channelsEnabled).toBe(true);

    const fromModern = applyPreferencesPatch(
      completePreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        pushEnabled: true,
      }),
      { emailEnabled: false }
    );

    expect(fromModern.emailEnabled).toBe(false);
    expect(fromModern.pushEnabled).toBe(true);
  });
});
