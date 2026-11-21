import type {
  EventCheckinDetail,
  EventCheckinResult,
} from '@filcdev/api/domains/events/checkin';
import { Button } from '@filcdev/ui/components/button';
import { cn } from '@filcdev/ui/lib/utils';
import { Ban, CheckCircle2, Clock3, SearchX, ShieldX } from 'lucide-react';
import { useId, useState } from 'react';
import { fill, formatWhen, type ScanLocale, type ScanStrings } from '@/i18n';

type Status = EventCheckinResult['status'];

/**
 * One tone and one icon per state, chosen so the answer is readable from arm's
 * length: green admits, amber repeats, red refuses, orange is the organizer's
 * own rule saying no, grey has no ticket.
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
  not_granted: {
    hint: 'resultNotGrantedHint',
    icon: ShieldX,
    title: 'resultNotGranted',
    tone: 'bg-orange-600 text-white',
  },
};

/** `✓` for a ticked checkbox, `✗` for an unticked one. */
const detailValue = (value: string | boolean): string => {
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  return value || '—';
};

/** The line under the verdict: the rule's own wording when it denied. */
const hintFor = (
  result: EventCheckinResult,
  locale: ScanLocale,
  s: ScanStrings
): string => {
  if (result.status === 'already_checked_in') {
    return fill(s.resultAlreadyHint, {
      name: result.checkedInByName ?? '—',
      time: formatWhen(result.checkedInAt, locale),
    });
  }
  if (result.status === 'not_granted') {
    return result.message || s.resultNotGrantedHint;
  }
  return s[LOOKS[result.status].hint];
};

type Props = {
  locale: ScanLocale;
  /** Restarts the scanner: closing the details is another way to say "next". */
  onClose: () => void;
  result: EventCheckinResult;
  strings: ScanStrings;
};

/** Covers the paused camera with the answer the helper reads out. */
export const ResultPanel = ({ locale, onClose, result, strings: s }: Props) => {
  const look = LOOKS[result.status];
  const Icon = look.icon;

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

      {/* The matched rule decides what arrives: a rule can hide the name
          entirely, so the block disappears rather than rendering it empty. */}
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

      {/* The answers the matched rule shows, under the person (or under the
          verdict). Six rows fit the panel; more scroll rather than push the
          verdict off screen. */}
      {result.status !== 'not_found' && result.answers.length > 0 ? (
        <div className="max-h-40 w-full max-w-sm space-y-1 overflow-y-auto text-left">
          {result.answers.map((answer) => (
            <p className="text-sm" key={answer.fieldId}>
              <span className="opacity-80">{answer.label}:</span>{' '}
              <span className="font-medium">{answer.value}</span>
            </p>
          ))}
        </div>
      ) : null}

      <p className="text-balance text-sm opacity-90">
        {hintFor(result, locale, s)}
      </p>

      {/* Everything else the registration answered, on demand: the helper opens
          it when the visible row is not enough, and closing it dismisses the
          result so the camera is ready for the next ticket. */}
      {result.status !== 'not_found' && result.details.length > 0 ? (
        <ResultDetails details={result.details} onClose={onClose} strings={s} />
      ) : null}
    </div>
  );
};

/** The collapsible "more information" block under a verdict. */
function ResultDetails({
  details,
  onClose,
  strings: s,
}: {
  details: EventCheckinDetail[];
  onClose: () => void;
  strings: ScanStrings;
}) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-sm space-y-2">
      <Button
        aria-controls={detailsId}
        aria-expanded={open}
        className="border-current/40 text-current hover:bg-white/10"
        onClick={() => setOpen((current) => !current)}
        type="button"
        variant="outline"
      >
        {s.resultDetails}
      </Button>

      {open ? (
        <div
          className="space-y-3 rounded-lg bg-black/15 p-3 text-left"
          id={detailsId}
        >
          <dl className="max-h-48 space-y-1 overflow-y-auto">
            {details.map((detail) => (
              <div
                className="grid grid-cols-[1fr_auto] gap-3"
                key={detail.fieldId}
              >
                <dt className="text-sm opacity-80">{detail.label}</dt>
                <dd className="text-right font-medium text-sm">
                  {detailValue(detail.value)}
                </dd>
              </div>
            ))}
          </dl>
          <Button
            className="w-full border-current/40 text-current hover:bg-white/10"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            {s.resultDetailsClose}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
