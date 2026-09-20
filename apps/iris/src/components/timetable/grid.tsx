import { cn } from '@filcdev/ui/lib/utils';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePinchZoom } from '@/hooks/use-pinch-zoom';
import {
  filterLessonsForGroupDisplay,
  type GroupDisplay,
  getLessonGroupEmphasis,
} from './helpers';
import { LessonCard } from './lesson-card';
import type {
  DayColumn,
  FilterType,
  GridCell,
  LessonItem,
  TimeSlot,
  TimetableViewModel,
} from './types';

type TimetableGridProps = {
  model: TimetableViewModel;
  userColors?: Record<string, number>;
  onColorChange?: (subject: string, colorIndex: number) => void;
  /** When 'teacher' or 'classroom', cohorts are shown on each lesson card. */
  activeFilter?: FilterType;
  /** Ids of the groups the current user belongs to (per division). */
  selectedGroupIds?: Set<string>;
  /** Division keys the user has picked a group in. */
  selectedDivisionTags?: Set<string>;
  /** How split lessons are shown. `'none'` disables group handling. */
  groupDisplay?: GroupDisplay;
};

type DayHeaderCellProps = {
  day: DayColumn;
  isEmpty: boolean;
  showBorder: boolean;
};

function DayHeaderCell({ day, isEmpty, showBorder }: DayHeaderCellProps) {
  return (
    <div
      className={cn(
        'p-3 text-center',
        showBorder && 'border-border border-r-2'
      )}
    >
      <span
        className={cn(
          'font-bold text-[11px] uppercase tracking-widest',
          isEmpty ? 'text-muted-foreground/40' : 'text-foreground'
        )}
      >
        {day.label}
      </span>
    </div>
  );
}

function TimeCell({ slot }: { slot: TimeSlot }) {
  return (
    <div className="flex flex-col items-center justify-center border-border border-r bg-muted/30 py-2">
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
  );
}

type SplitLessonsProps = {
  borderClass: string;
  lessons: LessonItem[];
  onColorChange?: (subject: string, colorIndex: number) => void;
  selectedDivisionTags?: Set<string>;
  selectedGroupIds?: Set<string>;
  showCohorts: boolean;
  userColors?: Record<string, number>;
};

function SplitLessons({
  borderClass,
  lessons,
  onColorChange,
  selectedDivisionTags,
  selectedGroupIds,
  showCohorts,
  userColors,
}: SplitLessonsProps) {
  return (
    <div className={cn('min-h-24 p-0.5', borderClass)}>
      <div
        className={cn(
          'h-full gap-0.5 overflow-hidden rounded-md bg-muted',
          getSplitGridClass(lessons.length)
        )}
      >
        {lessons.map((lesson, idx) => (
          <LessonCard
            emphasis={getLessonGroupEmphasis(
              lesson,
              selectedGroupIds,
              selectedDivisionTags
            )}
            key={lesson.id ?? idx}
            lesson={lesson}
            onColorChange={onColorChange}
            showCohorts={showCohorts}
            userColors={userColors}
          />
        ))}
      </div>
    </div>
  );
}

type DayCellProps = {
  borderClass: string;
  cellKey: string;
  day: DayColumn;
  emptyDayKeys: Set<string>;
  grid: Map<string, GridCell>;
  groupDisplay: GroupDisplay;
  midSlot: number;
  noLessonsLabel: string;
  onColorChange?: (subject: string, colorIndex: number) => void;
  selectedDivisionTags?: Set<string>;
  selectedGroupIds?: Set<string>;
  showCohorts: boolean;
  slotIndex: number;
  userColors?: Record<string, number>;
};

function DayCell({
  borderClass,
  cellKey,
  day,
  emptyDayKeys,
  grid,
  groupDisplay,
  midSlot,
  noLessonsLabel,
  onColorChange,
  selectedDivisionTags,
  selectedGroupIds,
  showCohorts,
  slotIndex,
  userColors,
}: DayCellProps) {
  if (emptyDayKeys.has(day.key)) {
    return (
      <div
        className={cn(
          'min-h-24 bg-muted/20',
          borderClass,
          slotIndex === midSlot && 'flex items-center justify-center p-2'
        )}
      >
        {slotIndex === midSlot && (
          <span className="text-center text-[11px] text-muted-foreground/50 leading-tight">
            {noLessonsLabel}
          </span>
        )}
      </div>
    );
  }

  const rawLessons = grid.get(cellKey)?.lessons ?? [];
  const lessons = filterLessonsForGroupDisplay(
    rawLessons,
    groupDisplay,
    selectedGroupIds,
    selectedDivisionTags
  );

  if (lessons.length === 0) {
    return <div className={cn('min-h-24 p-0.5', borderClass)} />;
  }

  const firstLesson = lessons[0];
  if (lessons.length === 1 && firstLesson) {
    return (
      <div className={cn('min-h-24 p-0.5', borderClass)}>
        <LessonCard
          emphasis={getLessonGroupEmphasis(
            firstLesson,
            selectedGroupIds,
            selectedDivisionTags
          )}
          lesson={firstLesson}
          onColorChange={onColorChange}
          showCohorts={showCohorts}
          userColors={userColors}
        />
      </div>
    );
  }

  return (
    <SplitLessons
      borderClass={borderClass}
      lessons={lessons}
      onColorChange={onColorChange}
      selectedDivisionTags={selectedDivisionTags}
      selectedGroupIds={selectedGroupIds}
      showCohorts={showCohorts}
      userColors={userColors}
    />
  );
}

export function TimetableGrid({
  model,
  userColors,
  onColorChange,
  activeFilter = 'class',
  selectedGroupIds,
  selectedDivisionTags,
  groupDisplay = 'none',
}: TimetableGridProps) {
  const { days, timeSlots, grid } = model;
  const { t } = useTranslation();
  const { ref: scrollRef, scale } = usePinchZoom<HTMLDivElement>();
  const showCohorts =
    activeFilter === 'teacher' || activeFilter === 'classroom';

  const emptyDayKeys = useMemo(
    () =>
      new Set(
        days
          .filter(
            (day) =>
              !timeSlots.some(
                (slot) =>
                  (grid.get(`${day.key}-${slot.start.format('HH:mm')}`)?.lessons
                    .length ?? 0) > 0
              )
          )
          .map((day) => day.key)
      ),
    [days, timeSlots, grid]
  );

  const noLessonsLabel = t('timetable.noLessonsOnThisDay');
  const colTemplate = `56px repeat(${days.length}, minmax(160px, 1fr))`;
  const minWidth = `${56 + days.length * 160}px`;
  const midSlot = Math.floor(timeSlots.length / 2);

  return (
    <div
      className="overflow-x-auto rounded-xl"
      ref={scrollRef}
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div
        className="rounded-xl border border-border bg-card"
        style={{ minWidth, zoom: scale }}
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 grid border-border border-b bg-muted/95 backdrop-blur"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <div className="p-2" />
          {days.map((day, i) => (
            <DayHeaderCell
              day={day}
              isEmpty={emptyDayKeys.has(day.key)}
              key={day.key}
              showBorder={i < days.length - 1}
            />
          ))}
        </div>

        {/* Body */}
        {timeSlots.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            {noLessonsLabel}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {timeSlots.map((slot, slotIndex) => (
              <div
                className="grid"
                key={slot.start.format('HH:mm')}
                style={{ gridTemplateColumns: colTemplate }}
              >
                {/* Time Cell */}
                <TimeCell slot={slot} />

                {/* Day Cells */}
                {days.map((day, i) => {
                  const cellKey = `${day.key}-${slot.start.format('HH:mm')}`;
                  return (
                    <DayCell
                      borderClass={
                        i < days.length - 1 ? 'border-border border-r-2' : ''
                      }
                      cellKey={cellKey}
                      day={day}
                      emptyDayKeys={emptyDayKeys}
                      grid={grid}
                      groupDisplay={groupDisplay}
                      key={cellKey}
                      midSlot={midSlot}
                      noLessonsLabel={noLessonsLabel}
                      onColorChange={onColorChange}
                      selectedDivisionTags={selectedDivisionTags}
                      selectedGroupIds={selectedGroupIds}
                      showCohorts={showCohorts}
                      slotIndex={slotIndex}
                      userColors={userColors}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
