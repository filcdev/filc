import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/**
 * Which pane of the settings dialog is showing. Every section is reachable
 * from the dialog's own nav; a caller can also target one directly (the
 * notification viewer's "change cohort" button opens General).
 */
const settingsSections = [
  'general',
  'appearance',
  'groups',
  'notifications',
  'apiKeys',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

type SettingsDialogState = {
  /** Open the dialog, optionally on a specific pane. */
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  /** Move the dialog to another pane; used by its own nav. */
  selectSettingsSection: (section: SettingsSection) => void;
  open: boolean;
  section: SettingsSection;
};

const SettingsDialogContext = createContext<SettingsDialogState | null>(null);

/**
 * The dialog is mounted once, at the app root, so any component can open it
 * without threading a callback down or mounting a second instance.
 *
 * The state is React state, not a module-level store: the app is rendered on
 * the server, where module scope is shared by every request the process serves.
 */
export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('general');

  const openSettings = useCallback((next: SettingsSection = 'general') => {
    setSection(next);
    setOpen(true);
  }, []);
  const closeSettings = useCallback(() => setOpen(false), []);
  const selectSettingsSection = useCallback(
    (next: SettingsSection) => setSection(next),
    []
  );

  const value = useMemo(
    () => ({
      closeSettings,
      open,
      openSettings,
      section,
      selectSettingsSection,
    }),
    [closeSettings, open, openSettings, section, selectSettingsSection]
  );

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
    </SettingsDialogContext.Provider>
  );
}

/** The dialog's open state, its selected pane and the way to change either. */
export function useSettingsDialog() {
  const context = useContext(SettingsDialogContext);
  if (!context) {
    throw new Error(
      'useSettingsDialog must be used within a SettingsDialogProvider.'
    );
  }

  return context;
}
