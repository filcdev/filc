import { useEffect, useSyncExternalStore } from 'react';

const VIEW_COOKIE_NAME = 'filc.timetable-view';
const VIEW_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export type TimetableView = 'grid' | 'card';

const isTimetableView = (value: unknown): value is TimetableView =>
  value === 'grid' || value === 'card';

const readCookie = (): TimetableView | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VIEW_COOKIE_NAME}=`));
  const value = match?.slice(VIEW_COOKIE_NAME.length + 1);
  return isTimetableView(value) ? value : null;
};

let view: TimetableView = 'grid';
/** Set once either the cookie or the stored preference has been consulted. */
let seeded = false;

const listeners = new Set<() => void>();

// Module-level so the reference is stable for `useSyncExternalStore`.
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => view;

const apply = (next: TimetableView, persist: boolean) => {
  if (next === view) {
    return;
  }
  view = next;
  if (persist) {
    // biome-ignore lint/suspicious/noDocumentCookie: read on the next visit
    document.cookie = `${VIEW_COOKIE_NAME}=${next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`;
  }
  for (const listener of listeners) {
    listener();
  }
};

/**
 * The timetable view preference: grid or the paper-like card.
 *
 * One module-level store, so the Appearance pane and the timetable page are the
 * same state: changing the control re-renders the timetable immediately, with
 * no reload. The choice persists in a cookie — available before the first paint
 * on the next visit, and it also applies to a signed-out visitor — and is
 * written to the stored preferences on save so it follows the account.
 *
 * Seeding happens in an effect, not during render: reading a cookie during
 * render would make the server and client disagree on the first HTML.
 */
export function useTimetableView(stored?: string) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (seeded) {
      return;
    }
    const cookie = readCookie();
    if (cookie) {
      seeded = true;
      apply(cookie, false);
      return;
    }
    // A device with no cookie yet adopts the account's stored value.
    if (isTimetableView(stored)) {
      seeded = true;
      apply(stored, false);
    }
  }, [stored]);

  return {
    setView: (next: TimetableView) => {
      seeded = true;
      apply(next, true);
    },
    view: current,
  };
}
