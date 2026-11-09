import type { SiteTheme } from '@filcdev/api/domains/theme';
import { useSession } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { DEFAULT_SITE_THEME } from '@filcdev/ui/lib/site-theme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';
import { useSiteTheme } from '@/hooks/site-theme';

/** The skins a visitor can be told about; `default` is the off state. */
const hasSeasonalCopy = (theme: string): theme is SiteTheme =>
  theme !== DEFAULT_SITE_THEME;

/**
 * Tells a signed-in visitor once that an admin has switched the site's seasonal
 * skin on, and offers the two answers worth having: "nice, keep it" or "never
 * for me". The acknowledgement is per skin, so the next season asks again, and
 * turning seasonal skins off silences this for good.
 *
 * Signed-out visitors are not asked: there is nowhere to remember the answer,
 * so the dialog would either nag on every page load or lie about permanence.
 */
export function SiteThemeNotice() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { data: siteTheme } = useSiteTheme();
  const settingsQuery = useNotificationSettings(!!session?.session);
  const saveSettings = useUpdateNotificationSettings();
  const [dismissed, setDismissed] = useState(false);

  const theme = siteTheme?.theme ?? DEFAULT_SITE_THEME;
  const settings = settingsQuery.data;

  const open =
    !dismissed &&
    !!session?.session &&
    !!settings &&
    settings.siteThemeEnabled &&
    hasSeasonalCopy(theme) &&
    settings.siteThemeAcknowledged !== theme;

  const acknowledge = (siteThemeEnabled: boolean) => {
    setDismissed(true);
    saveSettings.mutate({ siteThemeAcknowledged: theme, siteThemeEnabled });
  };

  if (!hasSeasonalCopy(theme)) {
    return null;
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        // Closing any other way (Escape, the X) still counts as "you have been
        // told": the toggle stays reachable under Settings → Appearance.
        if (!next) {
          acknowledge(settings?.siteThemeEnabled ?? true);
        }
      }}
      open={open}
    >
      <DialogContent>
        <DialogTitle>
          {t('siteTheme.notice.title', { name: t(`siteTheme.${theme}.name`) })}
        </DialogTitle>
        <DialogDescription>
          {t('siteTheme.notice.description', {
            name: t(`siteTheme.${theme}.name`),
          })}
        </DialogDescription>
        <DialogFooter>
          <Button onClick={() => acknowledge(true)} variant="outline">
            {t('siteTheme.notice.thanks')}
          </Button>
          <Button onClick={() => acknowledge(false)}>
            {t('siteTheme.notice.disable')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
