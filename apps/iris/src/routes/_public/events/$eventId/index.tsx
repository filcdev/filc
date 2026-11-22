import type { EventSignupRole } from '@filcdev/api/domains/events/registration';
import { useSession } from '@filcdev/auth/client';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  LogIn,
  Ticket,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerField } from '@/components/event-answer-field';
import {
  type EventDetail,
  type EventRegistrationItem,
  useCancelEventRegistration,
  useCreateEventRegistration,
  useEventDetail,
  useWithdrawHelperRegistration,
} from '@/hooks/events';
import { contentToText } from '@/utils/content';
import { formatEventAnswer } from '@/utils/event-fields';
import {
  eventRegistrationInfo,
  formatEventDateRange,
} from '@/utils/event-registration-state';
import { apiBaseUrl, orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_public/events/$eventId/')({
  component: EventDetailPage,
  loader: ({ context, params }) =>
    prefetch(
      context.queryClient,
      orpc.events.get.queryOptions({ input: { id: params.eventId } })
    ),
});

/**
 * The answers a student already gave, keyed by question, so re-registering
 * after a cancellation starts from what they wrote instead of an empty form.
 */
const seededAnswers = (
  registration: EventDetail['myRegistration']
): Record<string, string> =>
  Object.fromEntries(
    (registration?.answers ?? []).map((answer) => [
      answer.fieldId,
      answer.value,
    ])
  );

function SeatsSummary({ capacity, remaining }: EventDetail['seats']) {
  const { t } = useTranslation();
  if (capacity === null) {
    return (
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        <Users className="h-4 w-4" />
        {t('events.unlimited')}
      </span>
    );
  }
  if (remaining === 0) {
    return (
      <span className="flex items-center gap-2 font-medium text-destructive text-sm">
        <Users className="h-4 w-4" />
        {t('events.public.full')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 font-medium text-sm">
      <Ticket className="h-4 w-4" />
      {t('events.public.seatsLeft', { count: remaining })}
    </span>
  );
}

/**
 * What the ten-second poll can change under the visitor: whether they may still
 * register, or — while they may — how many places are left. The live region
 * below reads this, so a seat taken while the form is open is announced rather
 * than silently replacing the page.
 */
function availabilityAnnouncement(
  event: EventDetail,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (!event.eligibility.eligible) {
    return event.eligibility.reason
      ? t(`events.public.reasons.${event.eligibility.reason}`)
      : t('events.public.notAvailable');
  }

  const { capacity, remaining } = event.seats;
  if (capacity === null) {
    return t('events.unlimited');
  }
  return remaining === 0
    ? t('events.public.full')
    : t('events.public.seatsLeft', { count: remaining });
}

function RegistrationForm({
  canHelp,
  canParticipate,
  event,
}: {
  canHelp: boolean;
  canParticipate: boolean;
  event: EventDetail;
}) {
  const { t } = useTranslation();
  const register = useCreateEventRegistration();
  const [error, setError] = useState<string | null>(null);
  // Which button started the submit: the form itself always means a
  // participant, the helper button arms this ref before submitting.
  const signupRole = useRef<EventSignupRole>('participant');
  // Guest questions belong to the visitor form; this one is a student signup.
  const fields = event.fields.filter(
    (field) =>
      field.audiences.includes('student') || field.audiences.includes('helper')
  );
  const pendingRole = register.isPending ? register.variables?.role : undefined;

  const form = useForm({
    defaultValues: { answers: seededAnswers(event.myRegistration) },
    onSubmit: ({ value }) => {
      const missing = fields.find(
        (field) => field.required && !(value.answers[field.id] ?? '').trim()
      );
      if (missing) {
        // A choice has no native `required`, so the browser cannot catch it.
        setError(
          t('events.public.answersRequired', { question: missing.label })
        );
        return;
      }
      setError(null);
      register.mutate({
        answers: fields
          .map((field) => ({
            fieldId: field.id,
            value: value.answers[field.id] ?? '',
          }))
          .filter((answer) => answer.value.trim() !== ''),
        id: event.id,
        role: signupRole.current,
      });
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        signupRole.current = canParticipate ? 'participant' : 'helper';
        form.handleSubmit();
      }}
    >
      {fields.map((field) => (
        <form.Field key={field.id} name={`answers.${field.id}`}>
          {(answer) => (
            <Field>
              <FieldLabel htmlFor={`answer-${field.id}`}>
                {field.label}
                {field.required && (
                  <>
                    <span aria-hidden="true"> *</span>
                    <span className="sr-only">
                      {' '}
                      ({t('events.questionRequired')})
                    </span>
                  </>
                )}
              </FieldLabel>
              <AnswerField
                field={field}
                onChange={answer.handleChange}
                value={answer.state.value ?? ''}
              />
              <FieldError errors={answer.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      ))}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canParticipate && (
          <Button disabled={register.isPending} type="submit">
            {pendingRole === 'participant' ? (
              <Spinner />
            ) : (
              t('events.public.register')
            )}
          </Button>
        )}
        {canHelp && (
          <Button
            disabled={register.isPending}
            onClick={() => {
              signupRole.current = 'helper';
              form.handleSubmit();
            }}
            type="button"
            variant="secondary"
          >
            {pendingRole === 'helper' ? (
              <Spinner />
            ) : (
              t('events.public.helperSignup')
            )}
          </Button>
        )}
      </div>

      {canHelp && (
        <p className="text-muted-foreground text-xs">
          {t('events.public.helperSignupHint')}
        </p>
      )}
    </form>
  );
}

/** The answers a registration carries, labelled by the event's questions. */
function RegistrationAnswers({
  event,
  registration,
}: {
  event: EventDetail;
  registration: EventRegistrationItem;
}) {
  const { t } = useTranslation();

  if (registration.answers.length === 0) {
    return null;
  }

  return (
    <dl className="space-y-1 text-sm">
      {registration.answers.map((answer) => {
        const field = event.fields.find((item) => item.id === answer.fieldId);
        return (
          <div className="flex gap-2" key={answer.fieldId}>
            <dt className="text-muted-foreground">{field?.label ?? '—'}</dt>
            <dd>{formatEventAnswer(field?.type ?? 'text', answer.value, t)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function RegisteredCard({
  event,
  registration,
}: {
  event: EventDetail;
  registration: EventRegistrationItem;
}) {
  const { t } = useTranslation();
  const cancel = useCancelEventRegistration();
  const isHelper = registration.role === 'helper';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {t(
            isHelper
              ? 'events.public.helperConfirmedTitle'
              : 'events.public.registeredTitle'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {t(
            isHelper
              ? 'events.public.helperConfirmedHint'
              : 'events.public.registeredHint'
          )}
        </p>
        <RegistrationAnswers event={event} registration={registration} />
        <Button
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate({ id: event.id, registrationId: registration.id })
          }
          type="button"
          variant="outline"
        >
          {t('events.public.cancelRegistration')}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * A helper signup the organizer has not answered yet: it is not a confirmed
 * place, so it must not read like `RegisteredCard`.
 */
function PendingCard({
  event,
  registration,
}: {
  event: EventDetail;
  registration: EventRegistrationItem;
}) {
  const { t } = useTranslation();
  const withdraw = useWithdrawHelperRegistration();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {t('events.public.helperPendingTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {t('events.public.helperPendingHint')}
        </p>
        <RegistrationAnswers event={event} registration={registration} />
        <Button
          disabled={withdraw.isPending}
          onClick={() =>
            withdraw.mutate({ id: event.id, registrationId: registration.id })
          }
          type="button"
          variant="outline"
        >
          {withdraw.isPending ? (
            <Spinner />
          ) : (
            t('events.public.helperPendingWithdraw')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * When the event is and when signup runs: two labelled rows above the signup
 * button, so "not open yet" reads as the opening moment.
 */
function EventFacts({ event }: { event: EventDetail }) {
  const { i18n, t } = useTranslation();
  const info = eventRegistrationInfo(event, { language: i18n.language, t });

  return (
    <dl className="grid gap-x-3 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {t('events.public.eventDate')}
      </dt>
      <dd className="wrap-break-word min-w-0">
        {formatEventDateRange(event.startsAt, event.endsAt, i18n.language)}
      </dd>
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Ticket className="h-4 w-4" />
        {t('events.public.registration.label')}
      </dt>
      <dd className="flex flex-wrap items-center gap-2">
        <Badge variant={info.state === 'open' ? 'secondary' : 'outline'}>
          {info.status}
        </Badge>
        {info.range && (
          <span className="wrap-break-word min-w-0 text-muted-foreground">
            {info.range}
          </span>
        )}
      </dd>
    </dl>
  );
}

/** The refusal line for the viewer's participant eligibility. */
function eligibilityLabel(
  event: EventDetail,
  t: (key: string) => string
): string {
  return event.eligibility.reason
    ? t(`events.public.reasons.${event.eligibility.reason}`)
    : t('events.public.notAvailable');
}

/** Why the helper form is not offered, in the shared eligibility copy. */
function helperEligibilityLabel(
  event: EventDetail,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return event.helperEligibility.reason
    ? t(`events.public.reasons.${event.helperEligibility.reason}`)
    : t('events.public.notAvailable');
}

/** The signup card's title: helper-only, a fresh signup, or a re-signup. */
function signupTitle(
  canParticipate: boolean,
  cancelled: boolean,
  t: (key: string) => string
): string {
  if (!canParticipate) {
    return t('events.public.helperSignup');
  }
  return cancelled
    ? t('events.public.cancelledHint')
    : t('events.public.formTitle');
}

/**
 * What the signup area offers this viewer: waiting for approval, registered,
 * signup (participant, helper, or both), or why neither is possible.
 */
function RegistrationSection({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const registration = event.myRegistration;

  if (registration?.status === 'pending') {
    return <PendingCard event={event} registration={registration} />;
  }

  if (registration?.status === 'confirmed') {
    return <RegisteredCard event={event} registration={registration} />;
  }

  const canParticipate = event.eligibility.eligible;
  // A helper takes no seat, so a full event still takes them; the helper rules
  // ignore seats, cohort and grade too, which is why this is its own decision.
  const canHelp = event.helperEligibility.eligible;

  if (canParticipate || canHelp) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {signupTitle(
              canParticipate,
              registration?.status === 'cancelled',
              t
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canParticipate ? null : (
            <p className="text-muted-foreground text-sm">
              {eligibilityLabel(event, t)}
            </p>
          )}
          {canParticipate && !canHelp && (
            <p className="text-muted-foreground text-sm">
              {helperEligibilityLabel(event, t)}
            </p>
          )}
          <RegistrationForm
            canHelp={canHelp}
            canParticipate={canParticipate}
            event={event}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <p className="text-muted-foreground text-sm">
          {eligibilityLabel(event, t)}
        </p>
        {event.eligibility.reason === 'sign_in_required' && !session?.user && (
          <Button render={<Link to="/auth/login" />}>
            <LogIn className="h-4 w-4" />
            {t('sign_in')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { t } = useTranslation();
  const { data: event, isPending } = useEventDetail(eventId);

  useEffect(() => {
    document.title = event ? `${event.title} | Filc` : t('PageTitles.events');
  }, [event, t]);

  if (isPending) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <p className="text-muted-foreground">{t('events.public.notFound')}</p>
        <Button render={<Link to="/events" />} variant="outline">
          {t('events.public.backToEvents')}
        </Button>
      </main>
    );
  }

  const bannerUrl = event.imageKey
    ? `${apiBaseUrl}/events/${event.id}/image?v=${event.imageUpdatedAt?.getTime() ?? ''}`
    : null;
  const description = contentToText(event.description);

  return (
    <main className="flex grow flex-col items-center gap-6 p-6">
      <article className="w-full max-w-3xl space-y-5">
        <Button render={<Link to="/events" />} size="sm" variant="ghost">
          ← {t('events.public.backToEvents')}
        </Button>

        {/* Seats and eligibility are polled: this is how they are announced. */}
        <p aria-live="polite" className="sr-only">
          {availabilityAnnouncement(event, t)}
        </p>

        {bannerUrl && (
          <img
            alt={t('events.public.bannerAlt', { title: event.title })}
            className="max-h-72 w-full rounded-xl object-cover"
            height={600}
            src={bannerUrl}
            width={800}
          />
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">
              {t(`events.categories.${event.category}`)}
            </Badge>
            <SeatsSummary {...event.seats} />
          </div>
          <h1 className="font-bold text-3xl text-foreground tracking-tight">
            {event.title}
          </h1>
        </div>

        {description && (
          <p className="whitespace-pre-line text-foreground/90 leading-relaxed">
            {description}
          </p>
        )}

        <EventFacts event={event} />

        <RegistrationSection event={event} />

        {event.guestRegistrationEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('events.public.guestTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t('events.public.guestHint')}
              </p>
              <Button
                render={
                  <Link
                    params={{ eventId: event.id }}
                    to="/events/$eventId/register"
                  />
                }
                variant="secondary"
              >
                {t('events.public.guestCta')}
              </Button>
            </CardContent>
          </Card>
        )}
      </article>
    </main>
  );
}
