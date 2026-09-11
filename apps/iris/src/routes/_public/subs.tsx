import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SubstitutionView } from '@/components/subs-view';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/utils/authentication';

// Map this page to /subs
export const Route = createFileRoute('/_public/subs')({
  component: App,
});

function App() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.substitutions');
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
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-sm">
          <CardHeader className="items-center space-y-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">{t('sign_in')}</CardTitle>
              <CardDescription className="text-balance text-base leading-relaxed">
                {t('microsoft.signInSubtitle')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-center text-muted-foreground text-sm leading-relaxed">
              {t('substitution.description')}
            </div>
            <Button
              className="h-11 w-full gap-2 font-medium"
              onClick={() => navigate({ to: '/auth/login' })}
            >
              <LogIn className="h-4 w-4" />
              {t('sign_in')}
            </Button>
            <p className="text-center text-muted-foreground text-xs">
              {t('microsoft.cardSubtitle')}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <SubstitutionView />;
}
