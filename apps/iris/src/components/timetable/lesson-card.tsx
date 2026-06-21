import { Clock, MapPinIcon, UserIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/utils';
import { ColorPicker } from './color-picker';
import {
  formatRooms,
  formatTeachers,
  getSubjectColor,
  toHHMM,
} from './helpers';
import type { LessonItem } from './types';

type LessonCardProps = {
  lesson: LessonItem;
  userColors?: Record<string, number>;
  onColorChange?: (subject: string, colorIndex: number) => void;
};

export function LessonCard({ lesson, userColors, onColorChange }: LessonCardProps) {
  const subject = lesson.subject?.name ?? '—';
  const short = lesson.subject?.short ?? subject;
  const teacher = formatTeachers(lesson.teachers);
  const room = formatRooms(lesson.classrooms);
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
              'group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-md border border-l-2 p-1 transition-colors hover:brightness-95',
              color.bg,
              color.border
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
