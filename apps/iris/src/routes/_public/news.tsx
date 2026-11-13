import { useSession } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { NewsPanel } from '@/components/news-panel';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_public/news')({
  component: NewsPage,
  loader: ({ context }) =>
    prefetch(
      context.queryClient,
      orpc.news.announcements.list.queryOptions({
        input: { includeAll: 'true' },
      })
    ),
});

function NewsPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.news');
  }, [t]);

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <main className="bg-background flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
        <Card className="border-border/50 w-full max-w-md shadow-sm">
          <CardHeader className="items-center space-y-4 text-center">
            <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
              <ShieldCheck className="text-primary h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">{t('sign_in')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-balance">
                {t('microsoft.signInSubtitle')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="h-11 w-full gap-2 font-medium"
              onClick={() => navigate({ to: '/auth/login' })}
            >
              <LogIn className="h-4 w-4" />
              {t('sign_in')}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              {t('microsoft.cardSubtitle')}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex grow flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl">
        <h1 className="text-foreground text-3xl font-bold tracking-tight">
          {t('news.title')}
        </h1>
        <div className="mt-4">
          <NewsPanel
            classId={session.user.cohortId}
            emptyMessage={t('announcements.noAnnouncements')}
          />
        </div>
      </div>
    </main>
  );
}
