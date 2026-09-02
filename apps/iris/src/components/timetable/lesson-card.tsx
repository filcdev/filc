import { Clock, GraduationCap, MapPinIcon, UserIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/utils';
import { ColorPicker } from './color-picker';
import {
  formatCohorts,
  formatRooms,
  formatTeachers,
  getSubjectColor,
  toHHMM,
} from './helpers';
import type { LessonItem } from './types';

/**
 * Build the "group" line on a lesson card. Split lessons show their split group
 * names (e.g. "angol1"); a combined whole-class lesson repeats the generic
 * "Egész osztály" group name, which is useless, so the actual classes
 * (cohorts) are shown instead. A single whole-class lesson shows nothing.
 */
const WHOLE_CLASS_GROUP_NAMES = new Set(['Egész osztály', 'Egesz osztaly']);

function formatGroupLabel(lesson: LessonItem): string {
  const groups = lesson.groups ?? [];
  const isWholeClass = (group: LessonItem['groups'][number]): boolean =>
    group.entireClass === true || WHOLE_CLASS_GROUP_NAMES.has(group.name);
  const splitGroups = groups.filter((group) => !isWholeClass(group));
  if (splitGroups.length > 0) {
    return Array.from(
      new Set(splitGroups.map((group) => group.name).filter(Boolean))
    ).join(', ');
  }
  const cohorts = lesson.cohorts ?? [];
  if (cohorts.length > 1) {
    return Array.from(new Set(cohorts.map((c) => c.name).filter(Boolean))).join(
      ', '
    );
  }
  return '';
}

type LessonCardProps = {
  lesson: LessonItem;
  userColors?: Record<string, number>;
  onColorChange?: (subject: string, colorIndex: number) => void;
  /** When set, cohorts are shown in the card (used for teacher/classroom filters). */
  showCohorts?: boolean;
  /**
   * How the card is emphasised relative to the current user's division groups:
   * `'mine'` (the user's group — highlighted), `'dim'` (a parallel group in a
   * division the user has picked — faded), or `'neutral'`.
   */
  emphasis?: 'mine' | 'dim' | 'neutral';
};

export function LessonCard({
  lesson,
  userColors,
  onColorChange,
  showCohorts = false,
  emphasis = 'neutral',
}: LessonCardProps) {
  const subject = lesson.subject?.name ?? '—';
  const short = lesson.subject?.short ?? subject;
  const teacher = formatTeachers(lesson.teachers);
  const room = formatRooms(lesson.classrooms);
  const cohort = showCohorts ? formatCohorts(lesson.cohorts) : '';
  const groupLabel = formatGroupLabel(lesson);
  const color = getSubjectColor(subject, userColors);

  const startTime = toHHMM(lesson.period?.startTime);
  const endTime = toHHMM(lesson.period?.endTime);
  const timeRange = `${startTime} - ${endTime}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              'group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-md border border-l-2 p-1 transition-[filter,opacity] duration-150 hover:brightness-95',
              color.bg,
              color.border,
              emphasis === 'dim' && 'opacity-70 saturate-90'
            )}
          >
            {onColorChange && subject !== '—' && (
              <div className="absolute top-0.5 right-0.5 z-10">
                <ColorPicker
                  currentIndex={userColors?.[subject]}
                  onSelect={(idx) => onColorChange(subject, idx)}
                />
              </div>
            )}
            <div className="font-semibold text-sm leading-none">{short}</div>
            {cohort && (
              <div className="mt-0.5 w-full truncate text-center text-muted-foreground text-xs">
                {cohort}
              </div>
            )}
            {groupLabel && (
              <div className="mt-0.5 w-full truncate text-center text-muted-foreground text-xs">
                {groupLabel}
              </div>
            )}
            {teacher && (
              <div className="mt-0.5 w-full truncate text-center text-muted-foreground text-xs">
                {teacher}
              </div>
            )}
            {room && (
              <div className="w-full truncate text-center text-muted-foreground text-xs">
                {room}
              </div>
            )}
          </div>
        }
      />
      <TooltipContent
        className={cn(
          'w-72 border bg-card p-0 text-foreground shadow-2xl',
          color.border
        )}
        side="bottom"
      >
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <h5 className="font-bold text-accent-foreground text-base leading-tight">
              {subject}
            </h5>
          </div>

          <div className="mb-3 flex items-center gap-2 border-b pb-3 text-muted-foreground text-xs">
            <Clock className="h-4 w-4" />
            <span className="font-medium text-foreground">{timeRange}</span>
          </div>

          <div className="space-y-2 text-xs">
            {cohort && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <GraduationCap />
                </span>
                <span className="font-bold text-foreground">{cohort}</span>
              </div>
            )}
            {teacher && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <UserIcon />
                </span>
                <span className="font-bold text-foreground">
                  {lesson.teachers.map((t) => t.name).join(', ')}
                </span>
              </div>
            )}
            {room && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <MapPinIcon />
                </span>
                <span className="font-bold text-foreground">{room}</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
