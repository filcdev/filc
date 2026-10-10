import { cn } from '@filcdev/ui/lib/utils';
import { differenceInDays, formatDistanceToNowStrict } from 'date-fns';
import { enUS, hu } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

type RelativeTimeProps = {
  date: string | Date | null | undefined;
  className?: string;
  addSuffix?: boolean;
};

export function RelativeTime({
  date,
  className,
  addSuffix = true,
}: RelativeTimeProps) {
  const { i18n } = useTranslation();

  if (!date) {
    return <span className="text-muted-foreground">-</span>;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return <span className="text-muted-foreground">-</span>;
  }

  const daysDiff = differenceInDays(new Date(), parsedDate);
  const isOld = daysDiff > 45;

  const locale = i18n.language.startsWith('hu') ? hu : enUS;
  const timeString = formatDistanceToNowStrict(parsedDate, {
    addSuffix,
    locale,
  });

  return (
    <span
      className={cn(isOld && 'font-medium text-amber-500', className)}
      title={parsedDate.toLocaleString(
        i18n.language === 'hu' ? 'hu-HU' : 'en-US'
      )}
    >
      {timeString}
    </span>
  );
}
