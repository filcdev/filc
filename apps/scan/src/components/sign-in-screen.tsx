import { authClient } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import { CalendarCheck, FingerprintPattern } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { LocaleToggle } from '@/components/locale-toggle';
import type { ScanLocale, ScanStrings } from '@/i18n';

type Props = {
  locale: ScanLocale;
  onLocaleChange: (locale: ScanLocale) => void;
  strings: ScanStrings;
};

/**
 * The same Entra sign-in Iris uses. The app is one page, so the return URL is
 * the page itself (with the fragment dropped: OAuth forbids one), and a
 * failure comes back as `?error=…` on this same page.
 */
export const SignInScreen = ({ locale, onLocaleChange, strings: s }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    new URLSearchParams(window.location.search).has('error')
      ? s.signInError
      : null
  );

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    setMessage(null);

    const callbackUrl = new URL(window.location.origin);
    callbackUrl.hash = '';

    try {
      await authClient.signIn.social({
        callbackURL: callbackUrl.href,
        errorCallbackURL: `${callbackUrl.href}?error=signin`,
        newUserCallbackURL: callbackUrl.href,
        provider: 'microsoft',
      });
    } catch (error) {
      setMessage(
        error instanceof Error && error.message ? error.message : s.signInError
      );
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex justify-end px-3 pt-3">
        <LocaleToggle
          label={s.localeSwitch}
          locale={locale}
          onChange={onLocaleChange}
        />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CalendarCheck className="size-8 text-primary" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-balance font-bold text-2xl">{s.signInTitle}</h1>
          <p className="text-balance text-muted-foreground">
            {s.signInSubtitle}
          </p>
        </div>

        <form className="w-full max-w-sm" onSubmit={handleSignIn}>
          <Button
            className="h-14 w-full text-base"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? (
              s.signInLoading
            ) : (
              <span className="flex items-center gap-2">
                <FingerprintPattern className="size-5" />
                {s.signInButton}
              </span>
            )}
          </Button>
        </form>

        {message ? (
          <p className="max-w-sm text-balance text-center text-destructive text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
};
