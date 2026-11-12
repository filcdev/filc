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
    expect(prefs.inAppEnabled).toBe(false);
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
    expect(partial.inAppEnabled).toBe(true);
  });

  it('keeps a modern row as stored', () => {
    const stored: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
      inAppEnabled: false,
      pushEnabled: true,
      substitution: false,
    };

    expect(completePreferences(stored)).toEqual(stored);
  });
});

describe('applyPreferencesPatch', () => {
  const legacyOff = completePreferences(LEGACY_OFF);

  it('leaves a legacy row off when the patch names only a type flag', () => {
    const next = applyPreferencesPatch(legacyOff, { substitution: false });

    expect(next.substitution).toBe(false);
    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(false);
    expect(next.inAppEnabled).toBe(false);
    expect(next.channelsEnabled).toBe(true);
  });

  it('turns only the channel the patch names on', () => {
    const next = applyPreferencesPatch(legacyOff, { emailEnabled: true });

    expect(next.emailEnabled).toBe(true);
    expect(next.pushEnabled).toBe(false);
    expect(next.inAppEnabled).toBe(false);
    expect(next.announcement).toBe(true);
  });

  it('keeps the channels a modern row already had', () => {
    const modern = completePreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
      inAppEnabled: true,
      pushEnabled: false,
    });

    const next = applyPreferencesPatch(modern, { blogPost: true });

    expect(next.blogPost).toBe(true);
    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(false);
    expect(next.inAppEnabled).toBe(true);
  });

  it('honours an explicit channel value over the resolved base', () => {
    const next = applyPreferencesPatch(legacyOff, {
      emailEnabled: false,
      inAppEnabled: true,
      pushEnabled: true,
    });

    expect(next.emailEnabled).toBe(false);
    expect(next.pushEnabled).toBe(true);
    expect(next.inAppEnabled).toBe(true);
    expect(next.channelsEnabled).toBe(true);
  });
});
