import { Button } from '@filcdev/ui/components/button';
import { ShieldX } from 'lucide-react';
import { LocaleToggle } from '@/components/locale-toggle';
import type { ScanLocale, ScanStrings } from '@/i18n';

type Props = {
  locale: ScanLocale;
  onLocaleChange: (locale: ScanLocale) => void;
  onSignOut: () => void;
  strings: ScanStrings;
};

/** Signed in, but the role has no `events:checkin`: say so and offer a way out. */
export const NoAccessScreen = ({
  locale,
  onLocaleChange,
  onSignOut,
  strings: s,
}: Props) => (
  <main className="flex min-h-dvh flex-col bg-background">
    <header className="flex justify-end px-3 pt-3">
      <LocaleToggle
        label={s.localeSwitch}
        locale={locale}
        onChange={onLocaleChange}
      />
    </header>

    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldX className="size-8 text-destructive" />
      </div>
      <h1 className="text-balance font-bold text-2xl">{s.noAccessTitle}</h1>
      <p className="max-w-sm text-balance text-muted-foreground">
        {s.noAccessBody}
      </p>
      <p className="font-mono text-muted-foreground text-xs">events:checkin</p>
      <Button onClick={onSignOut} type="button" variant="outline">
        {s.signOut}
      </Button>
    </div>
  </main>
);
