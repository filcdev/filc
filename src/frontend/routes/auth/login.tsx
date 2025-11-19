import { createFileRoute } from '@tanstack/react-router';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMicrosoft, FaShield } from 'react-icons/fa6';
import { Alert, AlertDescription } from '~/frontend/components/ui/alert';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
});

function RouteComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleMicrosoftSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authClient.signIn.social({
        callbackURL: new URL('/auth/welcome', window.location.origin).href,
        errorCallbackURL: new URL(
          '/auth/error?from=microsoft-oauth',
          window.location.origin
        ).href,
        newUserCallbackURL: new URL(
          '/auth/welcome',
          window.location.origin
        ).href,
        provider: 'microsoft',
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('microsoft.signInError')
      );
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FaShield className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-bold text-3xl text-foreground">
              {t('microsoft.signInTitle')}
            </h1>
            <p className="text-balance text-muted-foreground">
              {t('microsoft.signInSubtitle')}
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {t('microsoft.cardTitle')}
            </CardTitle>
            <CardDescription>
              {t('microsoft.cardSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleMicrosoftSignIn}>
              {error && (
                <Alert className="text-sm" variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="h-11 w-full font-medium"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? (
                  t('common.loading')
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FaMicrosoft className="h-4 w-4" />
                    {t('microsoft.signInButton')}
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-muted-foreground text-xs">
          <p>
            {t('login.byContinuing')}{' '}
            <a
              className="underline transition-colors hover:text-foreground"
              href="/legal/tos"
            >
              {t('termsOfService')}
            </a>{' '}
            {t('and')}{' '}
            <a
              className="underline transition-colors hover:text-foreground"
              href="/legal/privacy"
            >
              {t('privacyPolicy')}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
