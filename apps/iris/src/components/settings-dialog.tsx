import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Separator } from '@filcdev/ui/components/separator';
import { useIsMobile } from '@filcdev/ui/hooks/use-mobile';
import { cn } from '@filcdev/ui/lib/utils';
import {
  Bell,
  ChevronLeft,
  KeyRound,
  type LucideIcon,
  Palette,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiKeysPane } from '@/components/settings/api-keys-pane';
import { AppearancePane } from '@/components/settings/appearance-pane';
import { GeneralPane } from '@/components/settings/general-pane';
import { GroupsPane } from '@/components/settings/groups-pane';
import { NotificationsPane } from '@/components/settings/notifications-pane';
import {
  closeSettings,
  type SettingsSection,
  selectSettingsSection,
  useSettingsDialog,
} from '@/components/settings-dialog-store';

const NAV: {
  icon: LucideIcon;
  labelKey: string;
  section: SettingsSection;
}[] = [
  {
    icon: SlidersHorizontal,
    labelKey: 'preferences.general',
    section: 'general',
  },
  {
    icon: Palette,
    labelKey: 'preferences.appearance',
    section: 'appearance',
  },
  { icon: Users, labelKey: 'preferences.myGroups', section: 'groups' },
  {
    icon: Bell,
    labelKey: 'preferences.notifications',
    section: 'notifications',
  },
  { icon: KeyRound, labelKey: 'apiKeys.title', section: 'apiKeys' },
];

type PaneProps = {
  /** False while the dialog is closed: the pane stops fetching. */
  active: boolean;
  onClose: () => void;
};

const PANES: Record<SettingsSection, ComponentType<PaneProps>> = {
  apiKeys: ApiKeysPane,
  appearance: AppearancePane,
  general: GeneralPane,
  groups: GroupsPane,
  notifications: NotificationsPane,
};

export function SettingsDialog() {
  const { t } = useTranslation();
  const { open, section } = useSettingsDialog();
  const isMobile = useIsMobile();
  // On a phone the nav is a list and the pane replaces it; on a wider screen
  // both are visible side by side.
  const [mobilePaneOpen, setMobilePaneOpen] = useState(false);

  useEffect(() => {
    // Returning to the nav on close means reopening always starts at the list,
    // and a section the caller targeted is not skipped on the next open.
    if (!open) {
      setMobilePaneOpen(false);
    }
  }, [open]);

  // Focus lands on the dialog itself, not the first nav button: Base UI focuses
  // the first focusable child by default, which drew a focus ring around
  // "General" every time the dialog opened.
  const contentRef = useRef<HTMLDivElement>(null);

  const activeNav = NAV.find((item) => item.section === section) ?? {
    icon: SlidersHorizontal,
    labelKey: 'preferences.general',
    section: 'general' as const,
  };
  const Pane = PANES[section];
  // The nav is always visible on a wider screen; on a phone it is replaced by
  // the pane, which is why picking a section has to push the pane on there.
  const showNav = !(isMobile && mobilePaneOpen);
  const showPane = !isMobile || mobilePaneOpen;

  const goToSection = (next: SettingsSection) => {
    selectSettingsSection(next);
    setMobilePaneOpen(true);
  };

  return (
    <Dialog onOpenChange={(next) => !next && closeSettings()} open={open}>
      <DialogContent
        className="h-[85vh] max-h-[600px] gap-0 overflow-hidden p-0 outline-none md:max-w-[820px] md:p-0"
        initialFocus={contentRef}
        ref={contentRef}
        tabIndex={-1}
      >
        <DialogTitle className="sr-only">{t('preferences.title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('preferences.description')}
        </DialogDescription>

        <div className="flex h-full min-h-0">
          {showNav && (
            <nav
              aria-label={t('preferences.title')}
              className={cn(
                'flex flex-col overflow-y-auto border-sidebar-border p-3',
                // A fixed rail beside the pane, a full-width list on a phone.
                isMobile ? 'w-full p-4' : 'w-52 shrink-0 border-r'
              )}
            >
              <ul className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <li key={item.section}>
                    <button
                      className={cn(
                        'flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        item.section === section &&
                          'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      )}
                      onClick={() => goToSection(item.section)}
                      type="button"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {showPane && (
            <div className="flex min-h-0 flex-1 flex-col">
              <header className="flex h-14 shrink-0 items-center gap-2 px-4 md:h-16">
                {isMobile && (
                  <Button
                    aria-label={t('preferences.title')}
                    onClick={() => setMobilePaneOpen(false)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ChevronLeft />
                  </Button>
                )}
                <h2 className="font-medium text-base">
                  {t(activeNav.labelKey)}
                </h2>
              </header>
              <Separator />
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <Pane active={open} onClose={closeSettings} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
