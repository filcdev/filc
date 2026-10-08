import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
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
import { LayoutGrid, Table2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
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
 * How the app and the timetable look: theme and the timetable view.
 *
 * The view is a shared store, so flipping it here re-renders the timetable
 * behind the dialog immediately. The theme applies as soon as it is picked
 * (next-themes); both are written to the stored preferences on save.
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

  useEffect(() => {
    if (settingsQuery.data) {
      setTheme(settingsQuery.data.theme);
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
        onClick={() => saveSettings.mutate({ theme, timetableView: view })}
      >
        {saveSettings.isPending && <Spinner className="mr-2 h-4 w-4" />}
        {t('common.save')}
      </Button>
    </div>
  );
}
