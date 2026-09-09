import { cn } from '@/utils';
import { getLessonWeekType } from './helpers';
import type { LessonItem } from './types';

export function WeekBadge({
  lesson,
  className,
}: {
  lesson: LessonItem;
  className?: string;
}) {
  const week = getLessonWeekType(lesson);

  // Weekly lessons do not need a badge; only alternating lessons are marked.
  if (week === 'all') {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-md font-bold text-[10px] shadow-sm ring-1 ring-inset',
        week === 'A' &&
          'bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300',
        week === 'B' &&
          'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300',
        className
      )}
    >
      {week}
    </span>
  );
}
