import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { cn } from '@filcdev/ui/lib/utils';
import {
  AlertTriangle,
  Clock,
  GraduationCap,
  MapPinIcon,
  UserIcon,
} from 'lucide-react';
import { ColorPicker } from './color-picker';
import {
  formatCohorts,
  formatRooms,
  formatTeachers,
  getSubjectColor,
  toHHMM,
} from './helpers';
import {
  dominantOverlayTone,
  type LessonOverlay,
  MOVED_OVERLAY_BADGE_CLASS,
  MOVED_OVERLAY_RING_CLASS,
  MOVED_OVERLAY_SOFT_CLASS,
  overlayTextClass,
} from './lesson-overlay';
import type { LessonItem } from './types';
import { WeekBadge } from './week-badge';

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

const overlayRingClass = (overlays?: LessonOverlay[]): string => {
  const tone = dominantOverlayTone(overlays);
  if (tone === 'cancelled') {
    return 'ring-1 ring-destructive/60';
  }
  if (tone === 'moved') {
    return `ring-1 ${MOVED_OVERLAY_RING_CLASS}`;
  }
  if (tone === 'substitution') {
    return 'ring-1 ring-primary/60';
  }
  return '';
};

/**
 * The teacher stays on the card when a change is overlaid — the change label
 * is added underneath rather than replacing the name.
 */
function TeacherLine({
  teacher,
  overlays,
}: {
  teacher: string;
  overlays?: LessonOverlay[];
}) {
  if (!(teacher || overlays?.length)) {
    return null;
  }
  const tone = dominantOverlayTone(overlays) ?? 'substitution';

  return (
    <div className="mt-0.5 w-full min-w-0 text-center text-xs">
      {teacher && (
        <div className="truncate text-muted-foreground">{teacher}</div>
      )}
      {overlays?.length ? (
        <div
          className={cn(
            'truncate font-semibold',
            tone === 'moved'
              ? MOVED_OVERLAY_BADGE_CLASS
              : overlayTextClass(tone)
          )}
          title={overlays.map((overlay) => overlay.detail).join('\n')}
        >
          {overlays.map((overlay) => overlay.label).join(' ')}
        </div>
      ) : null}
    </div>
  );
}

function OverlayNotice({ overlay }: { overlay: LessonOverlay }) {
  return (
    <div
      className={cn(
        'mb-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs last:mb-0',
        overlay.tone === 'moved' ? MOVED_OVERLAY_SOFT_CLASS : 'bg-muted/60'
      )}
    >
      <AlertTriangle
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          overlayTextClass(overlay.tone)
        )}
      />
      <span className={cn('font-semibold', overlayTextClass(overlay.tone))}>
        {overlay.day} {overlay.detail}
      </span>
    </div>
  );
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
  /** Substitution/cancellation/move changes in the selected week. */
  overlays?: LessonOverlay[];
};

export function LessonCard({
  lesson,
  userColors,
  onColorChange,
  showCohorts = false,
  emphasis = 'neutral',
  overlays,
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
    <div className="h-full">
      <Popover>
        <PopoverTrigger
          nativeButton={false}
          openOnHover
          render={
            <div
              className={cn(
                'group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-md border border-l-2 p-1 transition-[filter,opacity] duration-150 hover:brightness-95',
                color.bg,
                color.border,
                emphasis === 'dim' && 'opacity-70 saturate-90',
                overlayRingClass(overlays)
              )}
            >
              <WeekBadge className="absolute top-1 left-1" lesson={lesson} />

              {onColorChange && subject !== '—' && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: positioning wrapper; stops click from reaching the popover trigger
                // biome-ignore lint/a11y/noStaticElementInteractions: positioning wrapper; stops click from reaching the popover trigger
                // biome-ignore lint/a11y/noNoninteractiveElementInteractions: positioning wrapper; stops click from reaching the popover trigger
                <div
                  className="absolute top-0.5 right-0.5 z-10"
                  onClick={(event) => event.stopPropagation()}
                >
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
              <TeacherLine overlays={overlays} teacher={teacher} />
              {room && (
                <div className="w-full truncate text-center text-muted-foreground text-xs">
                  {room}
                </div>
              )}
            </div>
          }
        />
        <PopoverContent
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

            {overlays?.map((overlay) => (
              <OverlayNotice key={overlay.id} overlay={overlay} />
            ))}

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
        </PopoverContent>
      </Popover>
    </div>
  );
}
