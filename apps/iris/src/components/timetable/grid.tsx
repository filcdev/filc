import { cn } from '@/utils';
import { LessonCard } from './lesson-card';
import type { TimetableViewModel } from './types';

type TimetableGridProps = {
  model: TimetableViewModel;
};

export function TimetableGrid({ model }: TimetableGridProps) {
  const { days, timeSlots, grid } = model;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card print:border-0">
      {/* Header Row */}
      <div
        className="grid gap-px border-border border-b bg-muted/50"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        <div className="p-2" />
        {days.map((day) => (
          <div
            className="p-3 text-center font-bold text-[11px] text-muted-foreground uppercase tracking-widest"
            key={day.name}
          >
            {day.name}
          </div>
        ))}
      </div>

      {/* Body Rows */}
      <div className="divide-y divide-border">
        {timeSlots.map((slot) => (
          <div
            className="grid gap-px"
            key={slot.start.format('HH:mm')}
            style={{
              gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
            }}
          >
            {/* Time Cell */}
            <div className="flex flex-col items-center justify-center border-border border-r bg-muted/30">
              <span className="font-medium text-[10px] text-muted-foreground">
                {slot.start.format('HH:mm')}
              </span>
              <span className="font-bold text-muted-foreground text-xs">
                {slot.index}.
              </span>
              <span className="font-medium text-[10px] text-muted-foreground">
                {slot.end.format('HH:mm')}
              </span>
            </div>

            {/* Day Cells */}
            {days.map((day) => {
              const cellKey = `${day.name}-${slot.start.format('HH:mm')}`;
              const cell = grid.get(cellKey);
              const lessons = cell?.lessons ?? [];

              if (lessons.length === 0) {
                return <div className="min-h-24 p-0.5" key={cellKey} />;
              }

              const isSingle = lessons.length === 1;
              const firstLesson = lessons[0];

              if (isSingle && firstLesson) {
                return (
                  <div className="min-h-24 p-0.5" key={cellKey}>
                    <LessonCard lesson={firstLesson} />
                  </div>
                );
              }

              // Split cell with multiple lessons
              return (
                <div className="min-h-24 p-0.5" key={cellKey}>
                  <div
                    className={cn(
                      'h-full gap-0.5 overflow-hidden rounded-md bg-muted',
                      getSplitGridClass(lessons.length)
                    )}
                  >
                    {lessons.map((lesson, idx) => (
                      <LessonCard key={lesson.id ?? idx} lesson={lesson} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Get CSS Grid class for split cells based on lesson count */
function getSplitGridClass(count: number): string {
  switch (count) {
    case 2:
      return 'grid grid-cols-2';
    case 3:
      return 'grid grid-cols-2 grid-rows-2 [&>*:last-child]:col-span-2';
    case 4:
      return 'grid grid-cols-2 grid-rows-2';
    case 5:
      return 'grid grid-cols-3 grid-rows-2';
    case 6:
      return 'grid grid-cols-3 grid-rows-2';
    default:
      return 'grid grid-cols-2';
  }
}
