import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle, Mail, Shield } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '~/frontend/components/ui/alert';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import { EmailInput } from '~/frontend/components/ui/email-input';
import { Label } from '~/frontend/components/ui/label';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
});

function RouteComponent() {
  const [username, setUsername] = useState('');
  const [fullEmail, setFullEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullEmail) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authClient.signIn.magicLink({
        email: fullEmail,
        newUserCallbackURL: new URL('/auth/welcome', window.location.origin)
          .href,
        callbackURL: new URL('/', window.location.origin).href,
        errorCallbackURL: new URL(
          '/auth/error?from=magic-link',
          window.location.origin
        ).href,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setIsEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('magicLink.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="font-bold text-2xl text-foreground">
                {t('magicLink.checkYourEmail')}
              </h1>
              <p className="text-balance text-muted-foreground">
                {t('magicLink.emailSentTo', { email: fullEmail })}
              </p>
            </div>
          </div>

          <Alert className="border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              {t('magicLink.clickTheLink')}
            </AlertDescription>
          </Alert>

          <div className="text-center">
            <Button
              className="text-sm"
              onClick={() => {
                setIsEmailSent(false);
                setUsername('');
                setFullEmail('');
              }}
              variant="outline"
            >
              {t('magicLink.sendToAnotherEmail')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-bold text-3xl text-foreground">
              {t('magicLink.welcomeBack')}
            </h1>
            <p className="text-balance text-muted-foreground">
              {t('magicLink.signInSubtitle')}
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {t('magicLink.signInWithMagicLink')}
            </CardTitle>
            <CardDescription>
              {t('magicLink.signInWithMagicLinkDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleMagicLinkSubmit}>
              <div className="space-y-2">
                <Label className="font-medium text-sm" htmlFor="email">
                  {t('magicLink.emailAddress')}
                </Label>
                <EmailInput
                  className="h-11"
                  domain="petrik.hu"
                  id="email"
                  onChange={setUsername}
                  onFullEmailChange={setFullEmail}
                  placeholder="your.name"
                  value={username}
                />
                {fullEmail && (
                  <p className="text-muted-foreground text-xs">
                    {t('magicLink.willSendTo', { email: fullEmail })}
                  </p>
                )}
              </div>

              {error && (
                <Alert className="text-sm" variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="h-11 w-full font-medium"
                disabled={!fullEmail || isLoading}
                type="submit"
              >
                {isLoading
                  ? t('magicLink.sending')
                  : t('magicLink.sendMagicLink')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-muted-foreground text-xs">
          <p>
            {t('magicLink.byContinuing')}{' '}
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
