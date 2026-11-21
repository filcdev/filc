import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Mail } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerField } from '@/components/event-answer-field';
import {
  type EventDetail,
  useEventDetail,
  useGuestRegistration,
} from '@/hooks/events';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_public/events/$eventId/register')({
  component: GuestRegisterPage,
  loader: ({ context, params }) =>
    prefetch(
      context.queryClient,
      orpc.events.get.queryOptions({ input: { id: params.eventId } })
    ),
});

/** The guest's own fields and the event's guest questions, in one form. */
function GuestForm({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const register = useGuestRegistration();
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const emailId = useId();
  // The questions aimed at visitors; a question may also be shown to students.
  const fields = event.fields.filter((field) =>
    field.audiences.includes('guest')
  );

  const form = useForm({
    defaultValues: {
      answers: {} as Record<string, string>,
      email: '',
      name: '',
    },
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
        email: value.email.trim(),
        id: event.id,
        name: value.name.trim(),
      });
    },
  });

  if (register.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('events.public.guestSuccessTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex items-start gap-2 text-muted-foreground text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            {t('events.public.guestSuccessBody', {
              email: form.getFieldValue('email').trim(),
            })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t('events.public.guestSuccessHint')}
          </p>
          <Button
            render={
              <Link
                params={{ ticketId: register.data.code }}
                to="/tickets/$ticketId"
              />
            }
          >
            {t('events.public.guestTicketLink')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={nameId}>
                {t('events.public.guestNameLabel')}
              </FieldLabel>
              <Input
                autoComplete="name"
                id={nameId}
                onChange={(change) => field.handleChange(change.target.value)}
                placeholder={t('events.public.guestNamePlaceholder')}
                required
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={emailId}>
                {t('events.public.guestEmailLabel')}
              </FieldLabel>
              <Input
                autoComplete="email"
                id={emailId}
                inputMode="email"
                onChange={(change) => field.handleChange(change.target.value)}
                placeholder={t('events.public.guestEmailPlaceholder')}
                required
                type="email"
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>

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

      <p className="text-muted-foreground text-xs">
        {t('events.public.guestEmailHint')}
      </p>

      <Button disabled={register.isPending} type="submit">
        {register.isPending ? <Spinner /> : t('events.public.guestSubmit')}
      </Button>
    </form>
  );
}

function GuestRegisterPage() {
  const { eventId } = Route.useParams();
  const { t } = useTranslation();
  const { data: event, isPending } = useEventDetail(eventId);

  useEffect(() => {
    document.title = event
      ? `${t('events.public.guestFormTitle')} · ${event.title} | Filc`
      : t('PageTitles.events');
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
      <main className="mx-auto w-full max-w-2xl space-y-4 p-6">
        <p className="text-muted-foreground">{t('events.public.notFound')}</p>
        <Button render={<Link to="/events" />} variant="outline">
          {t('events.public.backToEvents')}
        </Button>
      </main>
    );
  }

  return (
    <main className="flex grow flex-col items-center gap-6 p-6">
      <div className="w-full max-w-2xl space-y-4">
        <Button
          render={<Link params={{ eventId: event.id }} to="/events/$eventId" />}
          size="sm"
          variant="ghost"
        >
          ← {event.title}
        </Button>

        <div className="space-y-1">
          <h1 className="font-bold text-3xl text-foreground tracking-tight">
            {event.guestRegistrationEnabled
              ? t('events.public.guestFormTitle')
              : t('events.public.guestClosedTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">{event.title}</p>
        </div>

        {event.guestRegistrationEnabled ? (
          <GuestForm event={event} />
        ) : (
          <Card>
            <CardContent className="py-4">
              <p className="text-muted-foreground text-sm">
                {t('events.public.guestClosedBody')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
