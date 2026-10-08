import { useSyncExternalStore } from 'react';

/**
 * Which pane of the settings dialog is showing. Every section is reachable
 * from the dialog's own nav; a caller can also target one directly (the
 * notification viewer's "change cohort" button opens General).
 */
export const settingsSections = [
  'general',
  'groups',
  'notifications',
  'apiKeys',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

let state: { open: boolean; section: SettingsSection } = {
  open: false,
  section: 'general',
};

const listeners = new Set<() => void>();

// Module-level so the reference is stable: `useSyncExternalStore` resubscribes
// whenever `subscribe` changes identity.
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

const update = (next: Partial<typeof state>) => {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
};

/**
 * Open the settings dialog, optionally on a specific pane.
 *
 * The dialog is mounted once, at the app root, so any component can open it
 * without threading a callback down or mounting a second instance.
 */
export const openSettings = (section: SettingsSection = 'general') =>
  update({ open: true, section });

export const closeSettings = () => update({ open: false });

/** Move the dialog to another pane; used by its own nav. */
export const selectSettingsSection = (section: SettingsSection) =>
  update({ section });

/**
 * The dialog's open state and selected pane.
 *
 * `useSyncExternalStore` rather than context: the dialog is a sibling of the
 * routes, not an ancestor, and this keeps its subscription out of the render
 * path of every component in between.
 */
export const useSettingsDialog = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
