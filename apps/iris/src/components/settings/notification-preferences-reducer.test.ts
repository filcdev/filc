import { describe, expect, test } from 'bun:test';
import type { NotificationPreferences } from '@filcdev/api/domains/notifications';
import {
  initialNotificationPreferencesState,
  type NotificationPreferencesState,
  notificationPreferencesReducer,
} from './notification-preferences-reducer';

const serverPrefs = (
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences => ({
  announcement: true,
  announcementEmail: false,
  blogPost: true,
  channelsEnabled: true,
  doorlockCardUsed: false,
  emailEnabled: true,
  movedLesson: true,
  substitution: true,
  systemMessage: true,
  ...overrides,
});

/** A seeded pane with one unsaved toggle already applied. */
const seededWithToggle = (
  key: keyof NotificationPreferences = 'substitution'
): NotificationPreferencesState =>
  notificationPreferencesReducer(
    { dirty: new Set(), prefs: serverPrefs() },
    { key, type: 'toggle' }
  );

describe('notificationPreferencesReducer', () => {
  test('seed fills an empty state but never re-applies over existing state', () => {
    const seeded = notificationPreferencesReducer(
      initialNotificationPreferencesState,
      { server: serverPrefs(), type: 'seed' }
    );
    expect(seeded.prefs).toEqual(serverPrefs());

    const toggled = seededWithToggle('blogPost');
    const reseeded = notificationPreferencesReducer(toggled, {
      server: serverPrefs({ blogPost: false }),
      type: 'seed',
    });
    // The unsaved toggle survives a background refetch.
    expect(reseeded).toBe(toggled);
    expect(reseeded.dirty.has('blogPost')).toBe(true);
  });

  test('a sent key unchanged in flight leaves dirty and takes the server value', () => {
    const state = seededWithToggle('substitution');
    const next = notificationPreferencesReducer(state, {
      sentKeys: ['substitution'],
      sentValues: { substitution: false },
      server: serverPrefs({ substitution: false }),
      type: 'saved',
    });

    expect(next.dirty.size).toBe(0);
    expect(next.prefs?.substitution).toBe(false);
  });

  test('a sent key re-toggled during the request stays dirty with the local value', () => {
    const sent = seededWithToggle('substitution');
    // Second click while the save is in flight: back to the value the server
    // did not receive.
    const retoggled = notificationPreferencesReducer(sent, {
      key: 'substitution',
      type: 'toggle',
    });
    const next = notificationPreferencesReducer(retoggled, {
      sentKeys: ['substitution'],
      sentValues: { substitution: false },
      server: serverPrefs({ substitution: false }),
      type: 'saved',
    });

    expect(next.dirty.has('substitution')).toBe(true);
    expect(next.prefs?.substitution).toBe(true);
  });

  test('an untouched key adopts the server record', () => {
    const state = seededWithToggle('substitution');
    const next = notificationPreferencesReducer(state, {
      sentKeys: ['substitution'],
      sentValues: { substitution: false },
      server: serverPrefs({ blogPost: false, emailEnabled: false }),
      type: 'saved',
    });

    expect(next.prefs?.blogPost).toBe(false);
    expect(next.prefs?.emailEnabled).toBe(false);
    expect(next.dirty.has('blogPost')).toBe(false);
  });

  test('a key toggled during the request but not sent stays dirty', () => {
    const sent = seededWithToggle('substitution');
    const toggled = notificationPreferencesReducer(sent, {
      key: 'announcement',
      type: 'toggle',
    });
    const next = notificationPreferencesReducer(toggled, {
      sentKeys: ['substitution'],
      sentValues: { substitution: false },
      server: serverPrefs({ announcement: true, substitution: false }),
      type: 'saved',
    });

    expect(next.dirty.has('announcement')).toBe(true);
    expect(next.prefs?.announcement).toBe(false);
  });
});
