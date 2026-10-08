import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';

const NOTIFICATION_TYPES = [
  {
    key: 'substitution',
    labelKey: 'notifications.types.substitution' as const,
  },
  { key: 'movedLesson', labelKey: 'notifications.types.movedLesson' as const },
  {
    key: 'announcement',
    labelKey: 'notifications.types.announcement' as const,
  },
  {
    key: 'systemMessage',
    labelKey: 'notifications.types.systemMessage' as const,
  },
  { key: 'blogPost', labelKey: 'notifications.types.blogPost' as const },
  {
    key: 'doorlockCardUsed',
    labelKey: 'notifications.types.doorlockCardUsed' as const,
  },
];

const DEFAULT_PREFS = {
  announcement: true,
  blogPost: false,
  channelsEnabled: true,
  doorlockCardUsed: false,
  movedLesson: true,
  substitution: true,
  systemMessage: true,
};

/** Channel toggle plus the per-type preference checkboxes. */
export function NotificationsPane({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const channelsId = useId();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);

  const settingsQuery = useNotificationSettings(active);
  const saveSettings = useUpdateNotificationSettings({ onSaved: onClose });

  useEffect(() => {
    if (settingsQuery.data) {
      setPrefs(settingsQuery.data.notificationPreferences);
    }
  }, [settingsQuery.data]);

  const togglePref = (key: string) => {
    setPrefs((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.notifications')}</CardTitle>
          <CardDescription>
            {t('preferences.notificationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <label
              className="cursor-pointer font-medium text-sm leading-none"
              htmlFor={channelsId}
            >
              {t('preferences.channelsEnabled')}
            </label>
            <Checkbox
              checked={prefs.channelsEnabled}
              id={channelsId}
              onCheckedChange={() => togglePref('channelsEnabled')}
            />
          </div>
          {NOTIFICATION_TYPES.map(({ key, labelKey }) => (
            <div className="flex items-center justify-between gap-4" key={key}>
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor={`pref-${key}`}
              >
                {t(labelKey)}
              </label>
              <Checkbox
                checked={prefs[key]}
                id={`pref-${key}`}
                onCheckedChange={() => togglePref(key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={saveSettings.isPending}
        onClick={() => saveSettings.mutate({ notificationPreferences: prefs })}
      >
        {saveSettings.isPending && <Spinner className="mr-2 h-4 w-4" />}
        {t('common.save')}
      </Button>
    </div>
  );
}
