import type { EventCategory } from '@filcdev/api/domains/events/event';
import { Badge } from '@filcdev/ui/components/badge';
import { Empty } from '@filcdev/ui/components/empty';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CodeXml,
  Globe,
  Laptop,
  type LucideIcon,
  PartyPopper,
  School,
  Sparkles,
  Store,
  Ticket,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EVENTS_PAGE_SIZE,
  type EventItem,
  usePublicEvents,
} from '@/hooks/events';
import {
  type EventRegistrationState,
  eventRegistrationInfo,
  formatEventDateRange,
} from '@/utils/event-registration-state';
import { apiBaseUrl, orpc, prefetch } from '@/utils/orpc';

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

/**
 * One icon per category, declared as a `Record` so a new category is a compile
 * error here instead of a card with a missing picture. It is also the fallback
 * an event without a banner is drawn with.
 */
const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  career_day: Briefcase,
  codeweek: CodeXml,
  digital_week: Laptop,
  external: Globe,
  fair: Store,
  honfoglalo: Sparkles,
  open_day: School,
};

/** The card and hero focus ring, shared so every card is keyboard-visible. */
const CARD_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The banner of a published event, cache-busted by its upload time. */
function bannerUrlFor(event: EventItem): string | null {
  return event.imageKey
    ? `${apiBaseUrl}/events/${event.id}/image?v=${event.imageUpdatedAt?.getTime() ?? ''}`
    : null;
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

/** The event's own window: the start with its time, the end when another day. */
function EventDates({ endsAt, startsAt }: { endsAt: Date; startsAt: Date }) {
  const { i18n } = useTranslation();
  return <>{formatEventDateRange(startsAt, endsAt, i18n.language)}</>;
}

/**
 * A banner-less event still gets an image-shaped panel: its category's gradient
 * and icon, never an empty frame or a broken image.
 */
function CategoryPanel({
  category,
  className,
  iconClassName,
}: {
  category: EventCategory;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = CATEGORY_ICONS[category];

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 via-muted to-accent/30',
        className
      )}
    >
      {/* A soft brand glow so the panel reads as imagery, not as a hole. */}
      <span className="absolute -bottom-10 -left-6 size-36 rounded-full bg-primary/20 blur-2xl" />
      <span className="absolute -top-10 -right-8 size-32 rounded-full bg-accent/25 blur-2xl" />
      <Icon
        className={cn('relative text-primary/50', iconClassName ?? 'size-16')}
        strokeWidth={1.25}
      />
    </div>
  );
}

/** The registration state as a badge tone: open is loud, the rest are quiet. */
const REGISTRATION_VARIANT: Record<
  EventRegistrationState,
  'default' | 'outline' | 'secondary'
> = {
  closed: 'outline',
  off: 'outline',
  open: 'default',
  opens_later: 'secondary',
};

/** One labelled block of metadata, the two the cards have always shown. */
function MetaBlock({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="wrap-break-word text-foreground/90 text-sm leading-snug">
          {children}
        </p>
      </div>
    </div>
  );
}

/** One labelled block on the hero: same content, drawn for a photo. */
function HeroFact({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex w-full min-w-0 items-start gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-2 backdrop-blur-sm sm:w-auto">
      <Icon className="mt-0.5 size-4 shrink-0 text-white/70" />
      <div className="min-w-0">
        <p className="font-medium text-[0.7rem] text-white/60 uppercase tracking-wide">
          {label}
        </p>
        <p className="wrap-break-word text-sm text-white leading-snug">
          {children}
        </p>
      </div>
    </div>
  );
}

/**
 * The soonest upcoming event, drawn as a wide hero: its banner as the
 * background under a dark scrim, with the two metadata blocks, the places and
 * one call to action. Without a banner the category panel stands in.
 */
function FeaturedEvent({ event }: { event: EventItem }) {
  const { i18n, t } = useTranslation();
  const bannerUrl = bannerUrlFor(event);
  const info = eventRegistrationInfo(event, { language: i18n.language, t });

  return (
    <Link
      className={cn(
        'group relative block overflow-hidden rounded-2xl border bg-card transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
        CARD_FOCUS
      )}
      params={{ eventId: event.id }}
      to="/events/$eventId"
    >
      <div className="relative flex min-h-72 flex-col justify-end sm:min-h-96">
        {bannerUrl ? (
          <img
            alt={t('events.public.bannerAlt', { title: event.title })}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            height={900}
            src={bannerUrl}
            width={1600}
          />
        ) : (
          <CategoryPanel
            category={event.category}
            className="absolute inset-0"
            iconClassName="size-40 sm:size-56"
          />
        )}

        {/* The scrim is what makes white copy legible on an arbitrary photo. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/15"
        />

        <div className="relative flex flex-col gap-4 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-transparent bg-primary text-primary-foreground">
              {t('events.public.featured')}
            </Badge>
            <Badge
              className="border-white/25 bg-black/50 text-white backdrop-blur-sm"
              variant="outline"
            >
              {t(`events.categories.${event.category}`)}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-3 py-1 font-medium text-white text-xs backdrop-blur-sm">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  info.state === 'open' ? 'bg-emerald-400' : 'bg-white/50'
                )}
              />
              {info.status}
            </span>
          </div>
          <h2 className="max-w-2xl text-balance font-bold text-2xl text-white leading-tight tracking-tight sm:text-4xl">
            {event.title}
          </h2>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <HeroFact icon={CalendarDays} label={t('events.public.eventDate')}>
              <EventDates endsAt={event.endsAt} startsAt={event.startsAt} />
            </HeroFact>
            <HeroFact
              icon={Ticket}
              label={t('events.public.registration.label')}
            >
              {info.range ?? info.label}
            </HeroFact>
            <HeroFact icon={Users} label={t('events.public.seats')}>
              {seatLabel(t, event.seats)}
            </HeroFact>
          </div>
          {/* One link, so the call to action is a span, not a nested control. */}
          <span className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm shadow-sm transition-colors group-hover:bg-primary/90">
            {info.state === 'open'
              ? t('events.public.register')
              : t('events.public.details')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>{' '}
        </div>
      </div>
    </Link>
  );
}

/**
 * One event in the grid: the banner on top (or the category panel), the badge
 * over it, then the title and the same two metadata blocks the hero has. The
 * whole card is the link; hover and keyboard focus raise it the same way.
 */
function EventCard({ event }: { event: EventItem }) {
  const { i18n, t } = useTranslation();
  const bannerUrl = bannerUrlFor(event);
  const info = eventRegistrationInfo(event, { language: i18n.language, t });

  return (
    <Link
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
        CARD_FOCUS
      )}
      params={{ eventId: event.id }}
      to="/events/$eventId"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {bannerUrl ? (
          <img
            alt={t('events.public.bannerAlt', { title: event.title })}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            height={450}
            loading="lazy"
            src={bannerUrl}
            width={800}
          />
        ) : (
          <CategoryPanel category={event.category} className="size-full" />
        )}
        <Badge
          className="absolute top-2 left-2 bg-background/90 text-foreground backdrop-blur-sm"
          variant="secondary"
        >
          {t(`events.categories.${event.category}`)}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold text-base text-foreground leading-snug">
          {event.title}
        </h3>

        <div className="space-y-1.5">
          <MetaBlock icon={CalendarDays} label={t('events.public.eventDate')}>
            <EventDates endsAt={event.endsAt} startsAt={event.startsAt} />
          </MetaBlock>
          <MetaBlock
            icon={Ticket}
            label={t('events.public.registration.label')}
          >
            {info.range ?? info.label}
          </MetaBlock>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs">
            <Users className="size-3.5 text-muted-foreground" />
            {seatLabel(t, event.seats)}
          </span>
          <Badge variant={REGISTRATION_VARIANT[info.state]}>
            {info.status}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

/** Card-shaped placeholders, so the page has its structure while it loads. */
function EventsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Skeleton className="h-72 w-full rounded-2xl sm:h-96" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div className="overflow-hidden rounded-xl border" key={index}>
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsPage() {
  const { t } = useTranslation();
  const moreEventsId = useId();
  const { data: events, isPending } = usePublicEvents();

  useEffect(() => {
    document.title = t('PageTitles.events');
  }, [t]);

  // The public list is published events still ahead, soonest first, so the
  // first row is the one the page leads with.
  const featured = events?.[0];
  const rest = events?.slice(1) ?? [];

  return (
    <main className="flex grow flex-col items-center p-6">
      <div className="w-full max-w-6xl space-y-6">
        <h1 className="font-bold text-3xl text-foreground tracking-tight">
          {t('events.title')}
        </h1>

        {isPending && (
          <>
            <p className="sr-only">{t('common.loading')}</p>
            <EventsSkeleton />
          </>
        )}

        {!isPending && featured && <FeaturedEvent event={featured} />}

        {!isPending && rest.length > 0 && (
          <section aria-labelledby={moreEventsId} className="space-y-4">
            <h2
              className="font-semibold text-foreground text-lg tracking-tight"
              id={moreEventsId}
            >
              {t('events.public.moreEvents')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((item) => (
                <EventCard event={item} key={item.id} />
              ))}
            </div>
          </section>
        )}

        {!isPending && events?.length === 0 && (
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
