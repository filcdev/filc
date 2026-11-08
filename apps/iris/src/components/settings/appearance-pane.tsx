import { type ColorScheme, colorSchemeIds } from '@filcdev/api/domains/theme';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@filcdev/ui/components/toggle-group';
import { applyColorScheme } from '@filcdev/ui/lib/color-scheme';
import { cn } from '@filcdev/ui/lib/utils';
import { LayoutGrid, Table2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';
import {
  type TimetableView,
  useTimetableView,
} from '@/hooks/use-timetable-view';

/**
 * How the app and the timetable look: light/dark, the visitor's colour scheme,
 * the seasonal-skin opt-out and the timetable view.
 *
 * The view is a shared store, so flipping it here re-renders the timetable
 * behind the dialog immediately. The theme and the scheme apply as soon as they
 * are picked (next-themes, and the `data-color-scheme` attribute); everything
 * is written to the stored preferences on save.
 */
export function AppearancePane({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { setTheme: applyTheme } = useTheme();
  const settingsQuery = useNotificationSettings(active);
  const { setView, view } = useTimetableView(settingsQuery.data?.timetableView);
  const [theme, setTheme] = useState('system');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [siteThemeEnabled, setSiteThemeEnabled] = useState(true);
  const seasonalThemesId = useId();

  useEffect(() => {
    if (settingsQuery.data) {
      setTheme(settingsQuery.data.theme);
      setColorScheme(settingsQuery.data.colorScheme);
      setSiteThemeEnabled(settingsQuery.data.siteThemeEnabled);
    }
  }, [settingsQuery.data]);

  const saveSettings = useUpdateNotificationSettings({
    onSaved: () => {
      applyTheme(theme);
      onClose();
    },
  });

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.appearance')}</CardTitle>
          <CardDescription>
            {t('preferences.appearanceDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span>{t('preferences.theme')}</span>
            <Select
              items={[
                { label: t('preferences.themeLight'), value: 'light' },
                { label: t('preferences.themeDark'), value: 'dark' },
                { label: t('preferences.themeSystem'), value: 'system' },
              ]}
              onValueChange={(value) => {
                if (value) {
                  setTheme(value);
                  applyTheme(value);
                }
              }}
              value={theme}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
            </Select>
          </div>

          <div className="space-y-2">
            <span>{t('preferences.colorScheme')}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {colorSchemeIds.map((id) => (
                <button
                  aria-pressed={colorScheme === id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    colorScheme === id
                      ? 'border-primary ring-1 ring-primary'
                      : 'hover:border-primary/40'
                  )}
                  key={id}
                  onClick={() => {
                    setColorScheme(id);
                    applyColorScheme(id);
                  }}
                  type="button"
                >
                  <span className="text-sm">
                    {t(`preferences.colorSchemeId.${id}`)}
                  </span>
                  <span className="flex gap-1" data-color-scheme={id}>
                    <span className="h-3 w-3 rounded-full bg-background ring-1 ring-border" />
                    <span className="h-3 w-3 rounded-full bg-primary" />
                    <span className="h-3 w-3 rounded-full bg-accent" />
                    <span className="h-3 w-3 rounded-full bg-foreground" />
                  </span>
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              {t('preferences.colorSchemeDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm" htmlFor={seasonalThemesId}>
                {t('preferences.seasonalThemes')}
              </label>
              <Checkbox
                checked={siteThemeEnabled}
                id={seasonalThemesId}
                onCheckedChange={(checked) =>
                  setSiteThemeEnabled(checked === true)
                }
              />
            </div>
            <p className="text-muted-foreground text-sm">
              {t('preferences.seasonalThemesDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t('preferences.timetableView')}</span>
              <ToggleGroup
                aria-label={t('preferences.timetableView')}
                onValueChange={(value) => {
                  const next = value[0] as TimetableView | undefined;
                  if (next) {
                    setView(next);
                  }
                }}
                value={[view]}
              >
                <ToggleGroupItem value="grid">
                  <LayoutGrid />
                  {t('timetable.viewGrid')}
                </ToggleGroupItem>
                <ToggleGroupItem value="card">
                  <Table2 />
                  {t('timetable.viewCard')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="text-muted-foreground text-sm">
              {t('preferences.timetableViewDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={saveSettings.isPending}
        onClick={() =>
          saveSettings.mutate({
            colorScheme,
            siteThemeEnabled,
            theme,
            timetableView: view,
          })
        }
      >
        {saveSettings.isPending && <Spinner className="mr-2 h-4 w-4" />}
        {t('common.save')}
      </Button>
    </div>
  );
}
