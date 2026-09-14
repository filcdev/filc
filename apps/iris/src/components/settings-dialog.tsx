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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MyGroupsSettingsCard } from '@/components/timetable/my-groups-card';
import type { CohortItem } from '@/components/timetable/types';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';
import { useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

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

// Sentinel value for the "no class" choice in the cohort <Select>.
// Cohort ids are UUIDs, so this cannot collide with a real id.
const NO_CLASS_VALUE = 'no-class';

/** The "Split classes" display preference (highlight vs. hide other groups). */
function GroupDisplaySelect({
  onValueChange,
  value,
}: {
  onValueChange: (value: 'highlight' | 'hide') => void;
  value: 'highlight' | 'hide';
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span>{t('preferences.groupDisplay')}</span>
      <Select
        items={[
          { label: t('preferences.groupDisplayHighlight'), value: 'highlight' },
          { label: t('preferences.groupDisplayHide'), value: 'hide' },
        ]}
        onValueChange={(v) => onValueChange(v as 'highlight' | 'hide')}
        value={value}
      >
        <SelectTrigger
          aria-label={t('preferences.groupDisplay')}
          className="w-40"
        >
          <SelectValue />
        </SelectTrigger>
      </Select>
    </div>
  );
}

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Language, theme, cohort and timetable group-display preferences. */
function GeneralSettingsCard({
  cohortQuery,
  language,
  onGroupDisplayChange,
  onLanguageChange,
  onSelectedCohortIdChange,
  onThemeChange,
  selectedCohortId,
  theme,
  timetableGroupDisplay,
}: {
  cohortQuery: UseQueryResult<CohortItem[], Error>;
  language: string;
  onGroupDisplayChange: (value: 'highlight' | 'hide') => void;
  onLanguageChange: (value: string | null) => void;
  onSelectedCohortIdChange: (value: string | null) => void;
  onThemeChange: (value: string) => void;
  selectedCohortId: string | null;
  theme: string;
  timetableGroupDisplay: 'highlight' | 'hide';
}) {
  const { t } = useTranslation();
  const languageItems = [
    { label: 'Magyar', value: 'hu' },
    { label: 'English', value: 'en' },
  ];
  const themeItems = [
    { label: t('preferences.themeLight'), value: 'light' },
    { label: t('preferences.themeDark'), value: 'dark' },
    { label: t('preferences.themeSystem'), value: 'system' },
  ];
  const cohortItems = [
    { label: t('cohort.noClass'), value: NO_CLASS_VALUE },
    ...(cohortQuery.data ?? []).map((cohort) => ({
      label: cohort.name,
      value: cohort.id,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences.general')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>{t('preferences.language')}</span>
          <Select
            items={languageItems}
            onValueChange={onLanguageChange}
            value={language}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('preferences.theme')}</span>
          <Select
            items={themeItems}
            onValueChange={(value) => {
              if (value) {
                onThemeChange(value);
              }
            }}
            value={theme}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span>{t('preferences.cohort')}</span>
            {cohortQuery.isLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <Select
                items={cohortItems}
                onValueChange={onSelectedCohortIdChange}
                value={selectedCohortId ?? NO_CLASS_VALUE}
              >
                <SelectTrigger className="w-32">
                  <SelectValue
                    placeholder={
                      cohortItems.length > 0
                        ? t('cohort.selectPlaceholder')
                        : t('cohort.noneFound')
                    }
                  />
                </SelectTrigger>
              </Select>
            )}
          </div>
          {cohortQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t('cohort.errorLoading', {
                  message: `${cohortQuery.error ?? ''}`,
                })}
              </AlertTitle>
            </Alert>
          ) : null}
        </div>

        <GroupDisplaySelect
          onValueChange={onGroupDisplayChange}
          value={timetableGroupDisplay}
        />
      </CardContent>
    </Card>
  );
}

/** Notification channel toggle plus the per-type preference checkboxes. */
function NotificationSettingsCard({
  channelsId,
  onTogglePref,
  prefs,
}: {
  channelsId: string;
  onTogglePref: (key: string) => void;
  prefs: Record<string, boolean>;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences.notifications')}</CardTitle>
        <CardDescription>
          {t('preferences.notificationsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label
            className="cursor-pointer font-medium text-sm leading-none"
            htmlFor={channelsId}
          >
            {t('preferences.channelsEnabled')}
          </label>
          <Checkbox
            checked={prefs.channelsEnabled}
            id={channelsId}
            onCheckedChange={() => onTogglePref('channelsEnabled')}
          />
        </div>
        {NOTIFICATION_TYPES.map(({ key, labelKey }) => (
          <div className="flex items-center justify-between" key={key}>
            <label
              className="cursor-pointer font-medium text-sm leading-none"
              htmlFor={`pref-${key}`}
            >
              {t(labelKey)}
            </label>
            <Checkbox
              checked={prefs[key]}
              id={`pref-${key}`}
              onCheckedChange={() => onTogglePref(key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { i18n, t } = useTranslation();
  const [, setCookie] = useCookies(['filc.language']);
  const channelsId = useId();
  const { setTheme: applyTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const [language, setLanguage] = useState('hu');
  const [theme, setTheme] = useState('system');
  const [timetableView, setTimetableView] = useState('class');
  const [timetableGroupDisplay, setTimetableGroupDisplay] = useState<
    'highlight' | 'hide'
  >('highlight');
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    announcement: true,
    blogPost: false,
    channelsEnabled: true,
    doorlockCardUsed: false,
    movedLesson: true,
    substitution: true,
    systemMessage: true,
  });

  const {
    data: settingsData,
    isLoading,
    isError,
    isSuccess,
  } = useNotificationSettings(open);

  useEffect(() => {
    if (!(isSuccess && settingsData)) {
      return;
    }
    setLanguage(settingsData.language);
    setTheme(settingsData.theme);
    setTimetableView(settingsData.timetableView);
    setTimetableGroupDisplay(
      settingsData.timetableGroupDisplay === 'hide' ? 'hide' : 'highlight'
    );
    setPrefs(settingsData.notificationPreferences);
  }, [isSuccess, settingsData]);

  const cohortQuery = useApiQuery<CohortItem[]>(() => api.cohort.index.$get(), {
    enabled: open,
    queryKey: queryKeys.cohorts(),
    select: (data) => data ?? [],
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedCohortId(session?.user?.cohortId ?? null);
  }, [open, session?.user?.cohortId]);

  const updateSettingsMutation = useUpdateNotificationSettings({
    onSaved: () => {
      applyTheme(theme);
      onOpenChange(false);
    },
    updateCohort: async () => {
      const currentCohortId = session?.user?.cohortId ?? null;
      const newCohortId =
        selectedCohortId === NO_CLASS_VALUE ? null : selectedCohortId;
      if (cohortQuery.isSuccess && newCohortId !== currentCohortId) {
        try {
          await authClient.updateUser({ cohortId: newCohortId });
        } catch {
          throw new Error('Failed to update cohort');
        }
      }
    },
  });

  const saveSettings = () =>
    updateSettingsMutation.mutate({
      language,
      notificationPreferences: prefs,
      theme,
      timetableGroupDisplay,
      timetableView,
    });

  const togglePref = (key: string) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleLanguageChange = (value: string | null) => {
    if (!value) {
      return;
    }

    setLanguage(value);
    i18n.changeLanguage(value).catch(() => {
      toast.error(t('preferences.languageChangeError'));
    });
    setCookie('filc.language', value, { sameSite: 'lax' });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = value;
    }
  };

  const ready = !(isLoading || isError);
  // The group picker is scoped to the user's *persisted* cohort, so memberships
  // are never saved for a cohort the user has only drafted in this dialog.
  const persistedCohortId = session?.user?.cohortId ?? null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('preferences.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Skeleton className="h-32 w-full" key={i} />
              ))}
            </div>
          ) : null}
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('preferences.loadError')}</AlertTitle>
            </Alert>
          ) : null}
          {ready ? (
            <>
              <GeneralSettingsCard
                cohortQuery={cohortQuery}
                language={language}
                onGroupDisplayChange={setTimetableGroupDisplay}
                onLanguageChange={handleLanguageChange}
                onSelectedCohortIdChange={setSelectedCohortId}
                onThemeChange={setTheme}
                selectedCohortId={selectedCohortId}
                theme={theme}
                timetableGroupDisplay={timetableGroupDisplay}
              />

              <MyGroupsSettingsCard cohortId={persistedCohortId} />

              <NotificationSettingsCard
                channelsId={channelsId}
                onTogglePref={togglePref}
                prefs={prefs}
              />

              <Button
                className="w-full"
                disabled={updateSettingsMutation.isPending}
                onClick={saveSettings}
              >
                {updateSettingsMutation.isPending && (
                  <Spinner className="mr-2 h-4 w-4" />
                )}
                {t('common.accept')}
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
