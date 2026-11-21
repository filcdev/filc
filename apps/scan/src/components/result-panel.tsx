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

      {/* Only a ticket of this event reaches these branches, so the visitor
          is shown for all of them but "not found". */}
      {result.status === 'not_found' ? null : (
        <div className="space-y-1">
          <p className="font-medium text-xs uppercase tracking-wide opacity-80">
            {s.resultVisitor}
          </p>
          <p className="text-balance font-semibold text-xl leading-tight">
            {result.visitorName}
          </p>
          <p className="break-all text-sm opacity-90">{result.visitorEmail}</p>
        </div>
      )}

      <p className="text-balance text-sm opacity-90">{hint}</p>
    </div>
  );
};
