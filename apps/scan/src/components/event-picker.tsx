import { Button } from '@filcdev/ui/components/button';
import { Spinner } from '@filcdev/ui/components/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@filcdev/ui/components/tooltip';
import { LogOut } from 'lucide-react';
import { LocaleToggle } from '@/components/locale-toggle';
import { NoAccessScreen } from '@/components/no-access-screen';
import { type ScanEvent, useEvents } from '@/hooks/events';
import { fill, formatWhen, type ScanLocale, type ScanStrings } from '@/i18n';

type Props = {
  locale: ScanLocale;
  onLocaleChange: (locale: ScanLocale) => void;
  onSelect: (event: ScanEvent) => void;
  onSignOut: () => void;
  strings: ScanStrings;
  userName: string;
};

/**
 * The events the door may scan. One tap per event, rows full width and tall
 * enough for a thumb: a helper never has to aim.
 */
export const EventPicker = ({
  locale,
  onLocaleChange,
  onSelect,
  onSignOut,
  strings: s,
  userName,
}: Props) => {
  const { data, error, isPending, refetch } = useEvents();
  const events = data?.items;

  const retry = () => {
    refetch();
  };

  // 403 is the endpoint saying "neither the permission nor a grant": that is
  // the no-access screen, not a failed load. Any other error keeps the retry.
  if (error && (error as { status?: number }).status === 403) {
    return (
      <NoAccessScreen
        locale={locale}
        onLocaleChange={onLocaleChange}
        onSignOut={onSignOut}
        strings={s}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h1 className="font-bold text-2xl">{s.pickerTitle}</h1>
          <p className="text-muted-foreground text-sm">{s.pickerSubtitle}</p>
          <p className="truncate text-muted-foreground text-xs">
            {fill(s.signedInAs, { name: userName })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LocaleToggle
            label={s.localeSwitch}
            locale={locale}
            onChange={onLocaleChange}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={s.signOut}
                  onClick={onSignOut}
                  size="icon-lg"
                  type="button"
                  variant="ghost"
                >
                  <LogOut />
                </Button>
              }
            />
            <TooltipContent>{s.signOut}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Spinner />
            <span>{s.pickerLoading}</span>
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-destructive">{s.pickerLoadError}</p>
            <Button onClick={retry} type="button" variant="outline">
              {s.pickerRetry}
            </Button>
          </div>
        ) : null}

        {events?.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {s.pickerEmpty}
          </p>
        ) : null}

        {events && events.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  className="flex min-h-16 w-full flex-col items-start justify-center gap-1 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors active:bg-muted"
                  onClick={() =>
                    onSelect({
                      expiresAt: event.expiresAt,
                      id: event.id,
                      startsAt: event.startsAt,
                      title: event.title,
                    })
                  }
                  type="button"
                >
                  <span className="font-semibold text-base leading-tight">
                    {event.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {formatWhen(event.startsAt, locale)}
                  </span>
                  {event.expiresAt ? (
                    <span className="text-muted-foreground text-xs">
                      {fill(s.pickerGrantUntil, {
                        date: formatWhen(event.expiresAt, locale),
                      })}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
};
