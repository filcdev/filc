import { Badge } from '@filcdev/ui/components/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Empty } from '@filcdev/ui/components/empty';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, PartyPopper, Ticket } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EVENTS_PAGE_SIZE,
  type EventItem,
  usePublicEvents,
} from '@/hooks/events';
import {
  eventRegistrationInfo,
  formatEventDateRange,
} from '@/utils/event-registration-state';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_public/events/')({
  component: EventsPage,
  loader: ({ context }) =>
    prefetch(
      context.queryClient,
      orpc.events.list.queryOptions({
        input: { limit: EVENTS_PAGE_SIZE, offset: 0 },
      })
    ),
});

/** The event's own window: the start with its time, the end when another day. */
function EventDates({ endsAt, startsAt }: { endsAt: Date; startsAt: Date }) {
  const { i18n } = useTranslation();
  return <>{formatEventDateRange(startsAt, endsAt, i18n.language)}</>;
}

/**
 * The signup window and whether it is open — read from the event, so every
 * visitor sees the same thing. Recomputed on each render, so the polled list
 * moves the line from "opens later" to "open" without a second clock.
 */
function RegistrationWindow({ event }: { event: EventItem }) {
  const { i18n, t } = useTranslation();
  const info = eventRegistrationInfo(event, { language: i18n.language, t });

  return (
    <span className="flex items-start gap-2 text-muted-foreground text-xs">
      <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="wrap-break-word min-w-0">{info.label}</span>
    </span>
  );
}

/** What a card says about places: none left, unlimited, or how many. */
function seatLabel(
  t: ReturnType<typeof useTranslation>['t'],
  seats: EventItem['seats']
): string {
  if (seats.capacity === null) {
    return t('events.unlimited');
  }
  if (seats.remaining === 0) {
    return t('events.public.full');
  }
  return t('events.public.seatsLeft', { count: seats.remaining });
}

function EventGrid({ events }: { events: EventItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((item) => (
        <Link
          className="block"
          key={item.id}
          params={{ eventId: item.id }}
          to="/events/$eventId"
        >
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">
                  {t(`events.categories.${item.category}`)}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {seatLabel(t, item.seats)}
                </span>
              </div>
              <CardTitle className="mt-2">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="flex items-center gap-2 text-muted-foreground text-sm">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <EventDates endsAt={item.endsAt} startsAt={item.startsAt} />
                </span>
              </p>
              <RegistrationWindow event={item} />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function EventsPage() {
  const { t } = useTranslation();
  const { data: events, isPending } = usePublicEvents();

  useEffect(() => {
    document.title = t('PageTitles.events');
  }, [t]);

  return (
    <main className="flex grow flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl space-y-4">
        <h1 className="font-bold text-3xl text-foreground tracking-tight">
          {t('events.title')}
        </h1>

        {isPending && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {!isPending && events && events.length > 0 && (
          <EventGrid events={events} />
        )}
        {!isPending && (!events || events.length === 0) && (
          <Empty
            description={t('events.public.emptyHint')}
            icon={<PartyPopper className="h-6 w-6" />}
            title={t('events.noEvents')}
          />
        )}
      </div>
    </main>
  );
}
