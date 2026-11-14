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
import { cn } from '@filcdev/ui/lib/utils';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';

type ChannelId = 'email';
type ChannelPrefKey = 'emailEnabled';

const NOTIFICATION_CHANNELS: Array<{
  channel: ChannelId;
  descriptionKey: string;
  key: ChannelPrefKey;
  labelKey: string;
}> = [
  {
    channel: 'email',
    descriptionKey: 'preferences.emailEnabledDescription',
    key: 'emailEnabled',
    labelKey: 'preferences.emailEnabled',
  },
];

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

/** Where the email toggle sits, then the per-type preferences. */
export function NotificationsPane({
  active,
  onClose,
  highlightChannel,
}: {
  active: boolean;
  onClose?: () => void;
  /** Channel to visually call out, e.g. the one an email footer linked to. */
  highlightChannel?: ChannelId;
}) {
  const { t } = useTranslation();
  // Seeded from the response only. The email default differs per role, so a
  // local fallback would assert a state the server may not return.
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);

  const settingsQuery = useNotificationSettings(active);
  const saveSettings = useUpdateNotificationSettings({ onSaved: onClose });

  useEffect(() => {
    if (settingsQuery.data) {
      setPrefs(settingsQuery.data.notificationPreferences);
    }
  }, [settingsQuery.data]);

  if (!prefs) {
    return <Skeleton className="h-64 w-full" />;
  }

  const togglePref = (key: string) => {
    setPrefs((previous) =>
      previous ? { ...previous, [key]: !previous[key] } : previous
    );
  };

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
          <div className="space-y-1">
            <p className="font-medium text-sm">{t('preferences.channels')}</p>
            <p className="text-muted-foreground text-xs">
              {t('preferences.channelsDescription')}
            </p>
          </div>
          {NOTIFICATION_CHANNELS.map(
            ({ channel, descriptionKey, key, labelKey }) => (
              <div
                className={cn(
                  'flex items-start justify-between gap-4 rounded-lg',
                  highlightChannel === channel &&
                    'bg-primary/5 p-2 ring-2 ring-primary/40'
                )}
                key={key}
              >
                <div className="space-y-0.5">
                  <label
                    className="cursor-pointer font-medium text-sm leading-none"
                    htmlFor={`channel-${key}`}
                  >
                    {t(labelKey)}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {t(descriptionKey)}
                  </p>
                </div>
                <Checkbox
                  checked={prefs[key]}
                  id={`channel-${key}`}
                  onCheckedChange={() => togglePref(key)}
                />
              </div>
            )
          )}
          <p className="text-muted-foreground text-xs">
            {t('preferences.channelDefaults')}
          </p>

          <div className="space-y-1 border-t pt-4">
            <p className="font-medium text-sm">{t('preferences.types')}</p>
            <p className="text-muted-foreground text-xs">
              {t('preferences.typesDescription')}
            </p>
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
