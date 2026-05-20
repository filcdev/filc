import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
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

export const Route = createFileRoute('/_private/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState('hu');
  const [theme, setTheme] = useState('system');
  const [timetableView, setTimetableView] = useState('class');
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
      return res;
    },
    onError: () => {
      toast.error(t('preferences.saveError'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.settings(),
      });
      toast.success(t('preferences.saveSuccess'));
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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-6 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-32 w-full" key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <AlertTitle>{t('preferences.loadError')}</AlertTitle>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-bold text-2xl">{t('preferences.title')}</h1>
        <p className="text-muted-foreground">{t('preferences.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.general')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>{t('preferences.language')}</span>
            <Select
              onValueChange={handleSelectChange(setLanguage)}
              value={language}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hu">Magyar</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('preferences.theme')}</span>
            <Select onValueChange={handleSelectChange(setTheme)} value={theme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t('preferences.themeLight')}
                </SelectItem>
                <SelectItem value="dark">
                  {t('preferences.themeDark')}
                </SelectItem>
                <SelectItem value="system">
                  {t('preferences.themeSystem')}
                </SelectItem>
              </SelectContent>
            </Select>
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
            <div className="flex items-center justify-between" key={key}>
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
    </div>
  );
}
