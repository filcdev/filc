import { formatLocalizedDate } from './date-locale';

/** The school's timezone: a public page renders on the server too. */
const EVENT_TIME_ZONE = 'Europe/Budapest';

/**
 * How every event surface shows a date: the day with its clock time, in the
 * school's timezone so a server render and a browser render agree.
 */
export const EVENT_DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: EVENT_TIME_ZONE,
};

type DateInput = Date | string;

/**
 * The event's own window: the start with its time, and the end only when the
 * event runs past its first day — a one-day event reads `14:00 – 17:00`.
 */
export function formatEventDateRange(
  startsAt: DateInput,
  endsAt: DateInput,
  language: string
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();

  return [
    formatLocalizedDate(start, language, EVENT_DATE_TIME),
    formatLocalizedDate(
      end,
      language,
      sameDay
        ? { timeStyle: 'short', timeZone: EVENT_TIME_ZONE }
        : EVENT_DATE_TIME
    ),
  ].join(' – ');
}

export const eventRegistrationStates = [
  'off',
  'opens_later',
  'closed',
  'open',
] as const;

/** Whether a visitor can sign up right now, and if not, why. */
export type EventRegistrationState = (typeof eventRegistrationStates)[number];

/** The fields of an event row the state is read from — never `eligibility`. */
export type EventRegistrationInput = {
  registrationClosesAt: DateInput | null;
  registrationEnabled: boolean;
  registrationOpensAt: DateInput | null;
};

type Translate = (key: string, options?: Record<string, string>) => string;

export type EventRegistrationInfo = {
  state: EventRegistrationState;
  /** The state word on its own, for a badge. */
  status: string;
  /** The registration window, or `null` when registration has no bound. */
  range: string | null;
  /** The whole line the public card shows: the state and its window. */
  label: string;
};

/**
 * The registration window as one string: both ends when both are set, the one
 * endpoint that exists otherwise, and `null` when registration never closes.
 */
function registrationRange(
  state: EventRegistrationState,
  opensAt: Date | null,
  closesAt: Date | null,
  language: string,
  t: Translate
): string | null {
  const at = (value: Date) =>
    formatLocalizedDate(value, language, EVENT_DATE_TIME);

  if (opensAt && closesAt) {
    return t('events.public.registration.range.both', {
      endsAt: at(closesAt),
      startsAt: at(opensAt),
    });
  }

  if (closesAt) {
    return state === 'open'
      ? t('events.public.registration.range.until', { endsAt: at(closesAt) })
      : at(closesAt);
  }

  if (opensAt) {
    return state === 'open'
      ? t('events.public.registration.range.from', { startsAt: at(opensAt) })
      : at(opensAt);
  }

  return null;
}

/**
 * The registration state of one event, derived from the event alone so every
 * viewer sees the same thing: switched off, not open yet, closed, or open.
 * The order matters — a disabled event is off even if its window is set.
 */
export function eventRegistrationInfo(
  event: EventRegistrationInput,
  {
    language,
    t,
    now = new Date(),
  }: { language: string; t: Translate; now?: Date }
): EventRegistrationInfo {
  const opensAt = event.registrationOpensAt
    ? new Date(event.registrationOpensAt)
    : null;
  const closesAt = event.registrationClosesAt
    ? new Date(event.registrationClosesAt)
    : null;

  let state: EventRegistrationState = 'open';
  if (!event.registrationEnabled) {
    state = 'off';
  } else if (opensAt && opensAt > now) {
    state = 'opens_later';
  } else if (closesAt && closesAt < now) {
    state = 'closed';
  }

  if (state === 'off') {
    return {
      label: t('events.public.registration.line.off'),
      range: null,
      state,
      status: t('events.public.registration.status.off'),
    };
  }

  const range = registrationRange(state, opensAt, closesAt, language, t);
  const status = t(`events.public.registration.status.${state}`);

  if (state === 'closed') {
    return {
      label: range
        ? t('events.public.registration.line.closedRange', { range })
        : t('events.public.registration.line.closed'),
      range,
      state,
      status,
    };
  }

  if (!range) {
    return {
      label: t('events.public.registration.line.open'),
      range,
      state,
      status,
    };
  }

  return {
    label:
      state === 'opens_later'
        ? t('events.public.registration.line.opensLater', { range })
        : t('events.public.registration.line.openRange', { range }),
    range,
    state,
    status,
  };
}
