import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { useEffect, useState } from 'react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CohortItem } from '@/components/timetable/types';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type PreferencesData = {
  language: string;
  theme: string;
  timetableView: string;
  notificationPreferences: {
    substitution: boolean;
    movedLesson: boolean;
    announcement: boolean;
    systemMessage: boolean;
    blogPost: boolean;
    doorlockCardUsed: boolean;
    channelsEnabled: boolean;
  };
};

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

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { i18n, t } = useTranslation();
  const [, setCookie] = useCookies(['filc.language']);
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [language, setLanguage] = useState('hu');
  const [theme, setTheme] = useState('system');
  const [timetableView, setTimetableView] = useState('class');
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

  const { isLoading, isError } = useQuery({
    enabled: open,
    queryFn: async () => {
      const res = await parseResponse(api.notifications.settings.$get());
      if (!res.success) {
        throw new Error('Failed to load settings');
      }
      const data = res.data as PreferencesData;
      setLanguage(data.language);
      setTheme(data.theme);
      setTimetableView(data.timetableView);
      setPrefs(data.notificationPreferences);
      return data;
    },
    queryKey: queryKeys.notifications.settings(),
  });

  const cohortQuery = useQuery({
    enabled: open,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error(t('cohort.fetchFailed'));
      }
      return (res.data ?? []) as CohortItem[];
    },
    queryKey: queryKeys.cohorts(),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedCohortId(session?.user?.cohortId ?? null);
  }, [open, session?.user?.cohortId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await parseResponse(
        api.notifications.settings.$patch({
          json: {
            language,
            notificationPreferences: prefs,
            theme,
            timetableView,
          },
        })
      );
      if (!res.success) {
        throw new Error('Failed to save settings');
      }

      const currentCohortId = session?.user?.cohortId ?? null;
      if (cohortQuery.isSuccess && selectedCohortId !== currentCohortId) {
        try {
          await authClient.updateUser({ cohortId: selectedCohortId });
        } catch {
          throw new Error('Failed to update cohort');
        }
      }

      return res;
    },
    onError: (error) => {
      if (
        error instanceof Error &&
        error.message === 'Failed to update cohort'
      ) {
        toast.error(t('welcome.cohortSaveFailed'));
        return;
      }
      toast.error(t('preferences.saveError'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.settings(),
      });
      toast.success(t('preferences.saveSuccess'));
      onOpenChange(false);
    },
  });

  const togglePref = (key: string) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleSelectChange = (
    setter: (v: string) => void
  ): ((value: string | null) => void) => {
    return (value: string | null) => {
      if (value) {
        setter(value);
      }
    };
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

  const languageItems = [
    { label: 'Magyar', value: 'hu' },
    { label: 'English', value: 'en' },
  ];

  const themeItems = [
    { label: t('preferences.themeLight'), value: 'light' },
    { label: t('preferences.themeDark'), value: 'dark' },
    { label: t('preferences.themeSystem'), value: 'system' },
  ];

  const cohortItems = (cohortQuery.data ?? []).map((cohort) => ({
    label: cohort.name,
    value: cohort.id,
  }));

  const ready = !(isLoading || isError);

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
              <Card>
                <CardHeader>
                  <CardTitle>{t('preferences.general')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>{t('preferences.language')}</span>
                    <Select
                      items={languageItems}
                      onValueChange={handleLanguageChange}
                      value={language}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('preferences.theme')}</span>
                    <Select
                      items={themeItems}
                      onValueChange={handleSelectChange(setTheme)}
                      value={theme}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {themeItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
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
                          onValueChange={setSelectedCohortId}
                          value={selectedCohortId}
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
                          <SelectContent>
                            {cohortItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('preferences.notifications')}</CardTitle>
                  <CardDescription>
                    {t('preferences.notificationsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>{t('preferences.channelsEnabled')}</span>
                    <Checkbox
                      checked={prefs.channelsEnabled}
                      onCheckedChange={() => togglePref('channelsEnabled')}
                    />
                  </div>
                  {NOTIFICATION_TYPES.map(({ key, labelKey }) => (
                    <div
                      className="flex items-center justify-between"
                      key={key}
                    >
                      <span>{t(labelKey)}</span>
                      <Checkbox
                        checked={prefs[key as keyof typeof prefs]}
                        onCheckedChange={() => togglePref(key)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button
                className="w-full"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(undefined)}
              >
                {saveMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                {t('common.accept')}
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
