import { describe, expect, it } from 'bun:test';
import {
  applyPreferencesPatch,
  completePreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '#utils/notifications/types';

/** The pre-split unsubscribe state: the master switch off, no email flag. */
const LEGACY_OFF = { channelsEnabled: false };

/** A row written before `announcementEmail` existed: the key is absent. */
const LEGACY_ROW: Omit<NotificationPreferences, 'announcementEmail'> = {
  announcement: true,
  blogPost: false,
  channelsEnabled: true,
  doorlockCardUsed: false,
  emailEnabled: true,
  movedLesson: true,
  substitution: true,
  systemMessage: true,
};

describe('completePreferences', () => {
  it('reads a legacy channelsEnabled:false row as email off', () => {
    const prefs = completePreferences(LEGACY_OFF);

    expect(prefs.emailEnabled).toBe(false);
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
  });

  it('keeps a modern row as stored', () => {
    const stored: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
      substitution: false,
    };

    expect(completePreferences(stored)).toEqual(stored);
  });

  it('applies the role default only to a row that does not name email', () => {
    const prefs = completePreferences(undefined, { email: false });

    expect(prefs.emailEnabled).toBe(false);
  });

  it('lets an explicit email value beat the role default', () => {
    const prefs = completePreferences({ emailEnabled: true }, { email: false });

    expect(prefs.emailEnabled).toBe(true);
  });

  it('lets the legacy channelsEnabled:false master switch beat the role default', () => {
    const prefs = completePreferences(LEGACY_OFF, { email: true });

    expect(prefs.emailEnabled).toBe(false);
  });
});

describe('announcementEmail', () => {
  it('resolves a row without the key to off', () => {
    const prefs = completePreferences(LEGACY_ROW);

    expect(prefs.announcementEmail).toBe(false);
    // The rest of the row is untouched: the type itself stays on.
    expect(prefs.announcement).toBe(true);
  });

  it('keeps an explicit opt-in through a patch that does not name it', () => {
    const next = applyPreferencesPatch(
      { ...LEGACY_ROW, announcementEmail: true },
      { substitution: false }
    );

    expect(next.announcementEmail).toBe(true);
    expect(next.substitution).toBe(false);
  });

  it('turns on when the patch names it', () => {
    const next = applyPreferencesPatch(LEGACY_ROW, {
      announcementEmail: true,
    });

    expect(next.announcementEmail).toBe(true);
    expect(next.announcement).toBe(true);
  });
});

describe('applyPreferencesPatch', () => {
  const legacyOff = completePreferences(LEGACY_OFF);

  it('leaves a legacy row off when the patch names only a type flag', () => {
    const next = applyPreferencesPatch(legacyOff, { substitution: false });

    expect(next.substitution).toBe(false);
    expect(next.emailEnabled).toBe(false);
    expect(next.channelsEnabled).toBe(true);
  });

  it('turns email on when the patch names it', () => {
    const next = applyPreferencesPatch(legacyOff, { emailEnabled: true });

    expect(next.emailEnabled).toBe(true);
    expect(next.announcement).toBe(true);
  });

  it('keeps the email state a modern row already had', () => {
    const modern = completePreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      emailEnabled: false,
    });

    const next = applyPreferencesPatch(modern, { blogPost: true });

    expect(next.blogPost).toBe(true);
    expect(next.emailEnabled).toBe(false);
  });

  it('honours an explicit email value over the role default', () => {
    const next = applyPreferencesPatch(
      { announcement: true },
      { emailEnabled: false },
      { email: true }
    );

    expect(next.emailEnabled).toBe(false);
    expect(next.channelsEnabled).toBe(true);
  });

  // `defaults` decides email only when the base does not name it, so this uses
  // a raw row with no email key: the suite fails if the argument stops being
  // forwarded and email falls back to the global `true` instead.
  it('forwards the role defaults for a base that names no channel key', () => {
    const student = applyPreferencesPatch(
      { announcement: true },
      { announcement: false },
      { email: false }
    );

    expect(student.announcement).toBe(false);
    expect(student.emailEnabled).toBe(false);

    // An explicit value in the base beats a contradicting default.
    const teacher = applyPreferencesPatch(
      { emailEnabled: true },
      { announcement: false },
      { email: false }
    );

    expect(teacher.emailEnabled).toBe(true);
  });

  // The unsubscribe page writes exactly this: the stored row completed, then
  // only email turned off.
  it('turns only email off for the unsubscribe write', () => {
    const fromLegacy = applyPreferencesPatch(completePreferences(LEGACY_OFF), {
      emailEnabled: false,
    });

    expect(fromLegacy.emailEnabled).toBe(false);
    expect(fromLegacy.channelsEnabled).toBe(true);

    const fromModern = applyPreferencesPatch(
      completePreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES }),
      { emailEnabled: false }
    );

    expect(fromModern.emailEnabled).toBe(false);
  });
});
