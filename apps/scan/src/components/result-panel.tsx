import type { EventCheckinResult } from '@filcdev/api/domains/events/checkin';
import { cn } from '@filcdev/ui/lib/utils';
import { Ban, CheckCircle2, Clock3, SearchX } from 'lucide-react';
import { fill, formatWhen, type ScanLocale, type ScanStrings } from '@/i18n';

type Status = EventCheckinResult['status'];

/**
 * One tone and one icon per state, chosen so the answer is readable from arm's
 * length: green admits, amber repeats, red refuses, grey has no ticket.
 */
const LOOKS: Record<
  Status,
  {
    hint: keyof ScanStrings;
    icon: typeof CheckCircle2;
    title: keyof ScanStrings;
    tone: string;
  }
> = {
  admitted: {
    hint: 'resultAdmittedHint',
    icon: CheckCircle2,
    title: 'resultAdmitted',
    tone: 'bg-primary text-primary-foreground',
  },
  already_checked_in: {
    hint: 'resultAlreadyHint',
    icon: Clock3,
    title: 'resultAlready',
    tone: 'bg-warning text-warning-foreground',
  },
  invalid: {
    hint: 'resultInvalidHint',
    icon: Ban,
    title: 'resultInvalid',
    tone: 'bg-destructive text-white',
  },
  not_found: {
    hint: 'resultNotFoundHint',
    icon: SearchX,
    title: 'resultNotFound',
    tone: 'bg-muted text-muted-foreground',
  },
};

type Props = {
  locale: ScanLocale;
  result: EventCheckinResult;
  strings: ScanStrings;
};

/** Covers the paused camera with the answer the helper reads out. */
export const ResultPanel = ({ locale, result, strings: s }: Props) => {
  const look = LOOKS[result.status];
  const Icon = look.icon;
  const hint =
    result.status === 'already_checked_in'
      ? fill(s.resultAlreadyHint, {
          name: result.checkedInByName ?? '—',
          time: formatWhen(result.checkedInAt, locale),
        })
      : s[look.hint];

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center',
        look.tone
      )}
      role="status"
    >
      <Icon className="size-16 shrink-0" strokeWidth={1.75} />
      <p className="text-balance font-bold text-3xl leading-tight">
        {s[look.title]}
      </p>

      {/* The event's check-in display decides what arrives: a minimal scan
          carries no person at all, so the block disappears rather than
          rendering an empty name. The header keeps the event and its time. */}
      {result.status !== 'not_found' &&
      (result.visitorName || result.visitorEmail) ? (
        <div className="space-y-1">
          <p className="font-medium text-xs uppercase tracking-wide opacity-80">
            {s.resultVisitor}
          </p>
          {result.visitorName ? (
            <p className="text-balance font-semibold text-xl leading-tight">
              {result.visitorName}
            </p>
          ) : null}
          {result.visitorEmail ? (
            <p className="break-all text-sm opacity-90">
              {result.visitorEmail}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The configured answers, under the person (or under the verdict in
          minimal mode). Six rows fit the panel; more scroll rather than push
          the verdict off screen. */}
      {result.status !== 'not_found' && result.answers.length > 0 ? (
        <div className="max-h-56 w-full max-w-sm space-y-1 overflow-y-auto text-left">
          {result.answers.map((answer) => (
            <p className="text-sm" key={answer.fieldId}>
              <span className="opacity-80">{answer.label}:</span>{' '}
              <span className="font-medium">{answer.value}</span>
            </p>
          ))}
        </div>
      ) : null}

      <p className="text-balance text-sm opacity-90">{hint}</p>
    </div>
  );
};
