import type { NotificationPreferences } from '@filcdev/api/domains/notifications';
import { Alert, AlertTitle } from '@filcdev/ui/components/alert';
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
import { useEffect, useId, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import {
  initialNotificationPreferencesState,
  notificationPreferencesReducer,
} from '@/components/settings/notification-preferences-reducer';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';

/**
 * One per-type preference row. `alwaysOnKey` marks a type the engine always
 * delivers: the row then renders checked and disabled with that description.
 */
type NotificationTypeRow = {
  key: keyof NotificationPreferences;
  labelKey: `notifications.types.${string}`;
  alwaysOnKey?: 'preferences.systemMessageAlwaysOn';
};

const NOTIFICATION_TYPES: NotificationTypeRow[] = [
  {
    key: 'substitution',
    labelKey: 'notifications.types.substitution',
  },
  { key: 'movedLesson', labelKey: 'notifications.types.movedLesson' },
  {
    key: 'announcement',
    labelKey: 'notifications.types.announcement',
  },
  {
    alwaysOnKey: 'preferences.systemMessageAlwaysOn',
    key: 'systemMessage',
    labelKey: 'notifications.types.systemMessage',
  },
  { key: 'blogPost', labelKey: 'notifications.types.blogPost' },
  {
    key: 'doorlockCardUsed',
    labelKey: 'notifications.types.doorlockCardUsed',
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
  highlightChannel?: 'email';
}) {
  const { t } = useTranslation();
  const announcementEmailId = useId();
  // Prefixes the per-type ids: the settings dialog and the standalone
  // /settings/notifications route can render a pane at the same time, so the
  // same `pref-substitution` in both would collide.
  const idPrefix = useId();
  const [state, dispatch] = useReducer(
    notificationPreferencesReducer,
    initialNotificationPreferencesState
  );
  const { dirty, prefs } = state;

  const settingsQuery = useNotificationSettings(active);
  const saveSettings = useUpdateNotificationSettings({ onSaved: onClose });

  useEffect(() => {
    const seed = settingsQuery.data?.notificationPreferences;
    if (seed) {
      dispatch({ server: seed, type: 'seed' });
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('preferences.loadError')}</AlertTitle>
      </Alert>
    );
  }

  if (!prefs) {
    return <Skeleton className="h-64 w-full" />;
  }

  const togglePref = (key: keyof NotificationPreferences) => {
    dispatch({ key, type: 'toggle' });
  };

  const savePreferences = () => {
    if (dirty.size === 0) {
      return;
    }
    // Snapshot what this request carries: a toggle made after the click must
    // not be treated as saved. The values matter as much as the keys, because
    // a key can be re-toggled (back to its sent value or away from it) before
    // the response lands. The reducer still reads the live state on success,
    // so a later toggle keeps its value instead of the snapshot's.
    const sentKeys = [...dirty];
    const sentValues: Partial<NotificationPreferences> = {};
    for (const key of sentKeys) {
      sentValues[key] = prefs[key];
    }
    saveSettings.mutate(
      { notificationPreferences: sentValues },
      {
        onSuccess: (settings) => {
          dispatch({
            sentKeys,
            sentValues,
            server: settings.notificationPreferences,
            type: 'saved',
          });
        },
      }
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
            <h3 className="font-medium text-sm">{t('preferences.channels')}</h3>
            <p className="text-muted-foreground text-xs">
              {t('preferences.channelsDescription')}
            </p>
          </div>
          <div
            className={cn(
              // Padded and outdented either way, so the highlight only paints
              // and the row never changes size or alignment.
              '-mx-2 flex items-start justify-between gap-4 rounded-lg px-2 py-2',
              highlightChannel === 'email' &&
                'bg-primary/5 ring-2 ring-primary/40'
            )}
          >
            <div className="space-y-0.5">
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor={`${idPrefix}-channel-emailEnabled`}
              >
                {t('preferences.emailEnabled')}
              </label>
              <p className="text-muted-foreground text-xs">
                {t('preferences.emailEnabledDescription')}
              </p>
            </div>
            <Checkbox
              checked={prefs.emailEnabled}
              id={`${idPrefix}-channel-emailEnabled`}
              onCheckedChange={() => togglePref('emailEnabled')}
            />
          </div>
          <div className="ml-6 flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor={announcementEmailId}
              >
                {t('preferences.announcementEmail')}
              </label>
              <p className="text-muted-foreground text-xs">
                {t('preferences.announcementEmailDescription')}
              </p>
            </div>
            <Checkbox
              checked={Boolean(prefs.announcementEmail)}
              disabled={!prefs.emailEnabled}
              id={announcementEmailId}
              onCheckedChange={() => togglePref('announcementEmail')}
            />
          </div>
          <div className="space-y-1 border-t pt-4">
            <h3 className="font-medium text-sm">{t('preferences.types')}</h3>
            <p className="text-muted-foreground text-xs">
              {t('preferences.typesDescription')}
            </p>
          </div>
          {NOTIFICATION_TYPES.map(({ alwaysOnKey, key, labelKey }) => {
            const inputId = `${idPrefix}-pref-${key}`;
            return (
              <div className="flex items-start justify-between gap-4" key={key}>
                <div className="space-y-0.5">
                  <label
                    className={cn(
                      'font-medium text-sm leading-none',
                      // A disabled row is not a control the user can operate,
                      // so it does not offer a pointer either.
                      alwaysOnKey ? undefined : 'cursor-pointer'
                    )}
                    htmlFor={inputId}
                  >
                    {t(labelKey)}
                  </label>
                  {alwaysOnKey ? (
                    <p className="text-muted-foreground text-xs">
                      {t(alwaysOnKey)}
                    </p>
                  ) : undefined}
                </div>
                <Checkbox
                  checked={alwaysOnKey ? true : prefs[key]}
                  disabled={Boolean(alwaysOnKey)}
                  id={inputId}
                  onCheckedChange={
                    alwaysOnKey ? undefined : () => togglePref(key)
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={saveSettings.isPending || dirty.size === 0}
        onClick={savePreferences}
      >
        {saveSettings.isPending && <Spinner className="mr-2 h-4 w-4" />}
        {t('common.save')}
      </Button>
    </div>
  );
}
