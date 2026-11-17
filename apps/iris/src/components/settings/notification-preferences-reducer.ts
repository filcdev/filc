import type { NotificationPreferences } from '@filcdev/api/domains/notifications';

/**
 * Everything the notification pane knows: the preferences on screen, plus the
 * keys the user changed and has not saved yet. One reducer owns both so the
 * save-merge rule can be tested without React.
 */
export type NotificationPreferencesState = {
  /** Keys the user touched; Save sends only these. */
  dirty: Set<keyof NotificationPreferences>;
  /** The preferences to render, or null until the query seeds them. */
  prefs: NotificationPreferences | null;
};

export type NotificationPreferencesAction =
  /** Arrived from the settings query; only ever applied once. */
  | { type: 'seed'; server: NotificationPreferences }
  | { type: 'toggle'; key: keyof NotificationPreferences }
  /**
   * A save came back. `sentKeys`/`sentValues` are what the request carried,
   * snapshotted at click time, and `server` is the merged record it answered.
   */
  | {
      type: 'saved';
      sentKeys: Array<keyof NotificationPreferences>;
      sentValues: Partial<NotificationPreferences>;
      server: NotificationPreferences;
    };

export const initialNotificationPreferencesState: NotificationPreferencesState =
  {
    dirty: new Set(),
    prefs: null,
  };

export function notificationPreferencesReducer(
  state: NotificationPreferencesState,
  action: NotificationPreferencesAction
): NotificationPreferencesState {
  switch (action.type) {
    case 'seed':
      // Seeded once: a background refetch must not overwrite the toggles the
      // user has already changed but not saved yet.
      return state.prefs === null
        ? { dirty: state.dirty, prefs: action.server }
        : state;

    case 'toggle': {
      const current = state.prefs;
      if (!current) {
        return state;
      }
      const prefs = { ...current };
      prefs[action.key] = !prefs[action.key];
      return {
        dirty: new Set(state.dirty).add(action.key),
        prefs,
      };
    }

    case 'saved': {
      const live = state.prefs ?? action.server;
      const sent = new Set(action.sentKeys);
      // A sent key whose local value still equals what this request carried is
      // saved: it leaves `dirty` and takes the server value. A sent key that
      // changed while the request was in flight, and any key this request did
      // not carry, keep their local value and stay dirty.
      const dirty = new Set(
        [...state.dirty].filter(
          (key) => !sent.has(key) || live[key] !== action.sentValues[key]
        )
      );
      // Everything else adopts the server's merged record, so a preference
      // changed on another device still shows up here.
      const prefs: NotificationPreferences = { ...action.server };
      for (const key of dirty) {
        prefs[key] = live[key];
      }
      return { dirty, prefs };
    }

    default:
      return state;
  }
}
