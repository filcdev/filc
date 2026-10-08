import { authClient, useSession } from '@filcdev/auth/client';
import { Alert, AlertTitle } from '@filcdev/ui/components/alert';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
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
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CohortItem } from '@/components/timetable/types';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/notifications';
import { sortCohorts } from '@/utils/cohort';
import { orpc } from '@/utils/orpc';

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
    <div className="flex items-center justify-between gap-4">
      <span>{t('preferences.groupDisplay')}</span>
      <Select
        items={[
          { label: t('preferences.groupDisplayHighlight'), value: 'highlight' },
          { label: t('preferences.groupDisplayHide'), value: 'hide' },
        ]}
        onValueChange={(next) => onValueChange(next as 'highlight' | 'hide')}
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
        <div className="flex items-center justify-between gap-4">
          <span>{t('preferences.language')}</span>
          <Select
            items={[
              { label: 'Magyar', value: 'hu' },
              { label: 'English', value: 'en' },
            ]}
            onValueChange={onLanguageChange}
            value={language}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span>{t('preferences.theme')}</span>
          <Select
            items={[
              { label: t('preferences.themeLight'), value: 'light' },
              { label: t('preferences.themeDark'), value: 'dark' },
              { label: t('preferences.themeSystem'), value: 'system' },
            ]}
            onValueChange={(value) => value && onThemeChange(value)}
            value={theme}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span>{t('preferences.cohort')}</span>
            {cohortQuery.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <Select
                items={cohortItems}
                onValueChange={onSelectedCohortIdChange}
                value={selectedCohortId ?? NO_CLASS_VALUE}
              >
                <SelectTrigger className="w-40">
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
          <p className="text-muted-foreground text-sm">
            {t('preferences.cohortDescription')}
          </p>
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

/**
 * Language, theme, cohort and timetable group-display preferences.
 *
 * `active` is the dialog's open state: the settings query is session-scoped, so
 * it stays disabled while the dialog is closed.
 */
export function GeneralPane({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const { i18n, t } = useTranslation();
  const [, setCookie] = useCookies(['filc.language']);
  const { setTheme: applyTheme } = useTheme();
  const { data: session } = useSession();
  const [language, setLanguage] = useState('hu');
  const [theme, setTheme] = useState('system');
  const [timetableView, setTimetableView] = useState('class');
  const [timetableGroupDisplay, setTimetableGroupDisplay] = useState<
    'highlight' | 'hide'
  >('highlight');
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

  const settingsQuery = useNotificationSettings(active);

  const cohortQuery = useQuery({
    ...orpc.cohort.cohort.queryOptions(),
    enabled: active,
    select: (data) => sortCohorts(data),
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) {
      return;
    }
    setLanguage(settings.language);
    setTheme(settings.theme);
    setTimetableView(settings.timetableView);
    setTimetableGroupDisplay(
      settings.timetableGroupDisplay === 'hide' ? 'hide' : 'highlight'
    );
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!active) {
      return;
    }
    setSelectedCohortId(session?.user?.cohortId ?? null);
  }, [active, session?.user?.cohortId]);

  const saveSettings = useUpdateNotificationSettings({
    onSaved: () => {
      applyTheme(theme);
      onClose();
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

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-32 w-full" key={i} />
        ))}
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('preferences.loadError')}</AlertTitle>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
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

      <Button
        className="w-full"
        disabled={saveSettings.isPending}
        onClick={() =>
          saveSettings.mutate({
            language,
            theme,
            timetableGroupDisplay,
            timetableView,
          })
        }
      >
        {saveSettings.isPending && <Spinner className="mr-2 h-4 w-4" />}
        {t('common.save')}
      </Button>
    </div>
  );
}
