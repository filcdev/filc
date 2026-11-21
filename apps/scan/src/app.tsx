import { permissions } from '@filcdev/api/permissions';
import { authClient, useSession } from '@filcdev/auth/client';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useState } from 'react';
import { EventPicker } from '@/components/event-picker';
import { NoAccessScreen } from '@/components/no-access-screen';
import { ScannerScreen } from '@/components/scanner-screen';
import { SignInScreen } from '@/components/sign-in-screen';
import type { ScanEvent } from '@/hooks/events';
import { detectLocale, type ScanLocale, strings } from '@/i18n';

/** `*` is the admin wildcard, the same way Iris reads the session's list. */
const canCheckIn = (granted: string[]): boolean =>
  granted.includes('*') || granted.includes(permissions.eventsCheckin);

/**
 * One page, three states: sign in, pick an event, scan. No router on purpose —
 * a door helper never links to a sub-screen, and a generated route tree would
 * be the only thing it added.
 */
export const App = () => {
  const [locale, setLocale] = useState<ScanLocale>(detectLocale);
  const [event, setEvent] = useState<ScanEvent | null>(null);
  const s = strings[locale];
  const { data: session, isPending } = useSession();

  const signOut = () => {
    authClient.signOut();
  };

  if (isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </main>
    );
  }

  if (!session) {
    return (
      <SignInScreen locale={locale} onLocaleChange={setLocale} strings={s} />
    );
  }

  if (!canCheckIn(session.user.permissions)) {
    return (
      <NoAccessScreen
        locale={locale}
        onLocaleChange={setLocale}
        onSignOut={signOut}
        strings={s}
      />
    );
  }

  if (event) {
    return (
      <ScannerScreen
        event={event}
        locale={locale}
        onExit={() => setEvent(null)}
        onLocaleChange={setLocale}
        strings={s}
      />
    );
  }

  return (
    <EventPicker
      locale={locale}
      onLocaleChange={setLocale}
      onSelect={setEvent}
      onSignOut={signOut}
      strings={s}
      userName={session.user.displayName}
    />
  );
};
