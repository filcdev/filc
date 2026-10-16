import { cn } from '@filcdev/ui/lib/utils';
import dayjs from 'dayjs';
import 'dayjs/locale/hu';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/utils/date-locale';

dayjs.extend(relativeTime);

/** Anything older than this is highlighted, so stale accounts stand out. */
const STALE_DAYS = 45;

type RelativeTimeProps = {
  date: string | Date | null | undefined;
  className?: string;
};

/**
 * "3 days ago", with the exact timestamp in the tooltip. Null and unparsable
 * values render as `-` rather than an epoch date.
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;

  if (!date) {
    return <span className="text-muted-foreground">-</span>;
  }

  const parsed = dayjs(date);
  if (!parsed.isValid()) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isStale = dayjs().diff(parsed, 'day') > STALE_DAYS;

  return (
    <span
      className={cn(isStale && 'font-medium text-amber-500', className)}
      title={formatLocalizedDate(parsed.toDate(), language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}
    >
      {parsed.locale(language).fromNow()}
    </span>
  );
}
