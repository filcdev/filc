import { Clock, GraduationCap, MapPinIcon, UserIcon } from 'lucide-react';
import { type CSSProperties, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/utils';
import { getSubjectColor, toHHMM } from '../helpers';
import type { LessonItem, PeriodItem } from '../types';
import {
  buildSecondaryModel,
  formatGroupCode,
  formatRoomCode,
  formatSubjectName,
  formatSubjectShort,
  formatTeacherSurname,
} from './helpers';
import type { SecondaryTimetableHeader } from './types';

/**
 * Column widths (in px). The day-label column is ~1.5× a period column (a bit
 * narrower than the 1.89× layout ratio); period columns are clamped to a fixed
 * maximum width so the card does not stretch arbitrarily on wide screens.
 */
const PERIOD_COLUMN_WIDTH = 96;
const DAY_LABEL_WIDTH = Math.round(PERIOD_COLUMN_WIDTH * 1.5);
const HEADER_ROW_HEIGHT = 64;
const DAY_ROW_HEIGHT = 112;

type Props = {
  lessons: LessonItem[];
  periods: PeriodItem[];
  /** Header block (class code etc.) shown above the grid. */
  header: SecondaryTimetableHeader;
  /** Locale, used to pick the day-label language. Defaults to `hu`. */
  language?: string;
};

/**
 * A single lesson inside a cell (a full-height entry, or one half of a split
 * A-week / B-week cell). The centre shows the subject, corners carry the
 * room/teacher/group annotations, and hovering reveals the full details.
 */
function LessonEntry({
  lesson,
  half,
  cohortShort,
}: {
  lesson: LessonItem;
  half: boolean;
  cohortShort?: string;
}) {
  const subjectShort = formatSubjectShort(lesson);
  const subject = formatSubjectName(lesson);
  const teacherSurname = formatTeacherSurname(lesson);
  const roomCode = formatRoomCode(lesson);
  const groupCode = formatGroupCode(lesson, cohortShort);

  const teachers = (lesson.teachers ?? [])
    .map((teacher) => teacher.name)
    .filter(Boolean)
    .join(', ');
  const rooms = (lesson.classrooms ?? [])
    .map((room) => room.name ?? room.short)
    .filter(Boolean)
    .join(', ');
  const timeRange = `${toHHMM(lesson.period?.startTime)} - ${toHHMM(
    lesson.period?.endTime
  )}`;
  const color = getSubjectColor(subject);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              'relative flex h-full w-full items-center justify-center px-1 py-0.5',
              half ? 'text-sm' : 'text-base'
            )}
          >
            <span className="max-w-full truncate font-semibold text-foreground leading-tight">
              {subjectShort}
            </span>
            {half && groupCode && (
              <span className="absolute top-0.5 right-1 text-[9px] text-muted-foreground leading-none">
                {groupCode}
              </span>
            )}
            {roomCode && (
              <span className="absolute bottom-0.5 left-1 text-[9px] text-muted-foreground leading-none">
                {roomCode}
              </span>
            )}
            {teacherSurname && (
              <span className="absolute right-1 bottom-0.5 text-[9px] text-muted-foreground leading-none">
                {teacherSurname}
              </span>
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
            {groupCode && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <GraduationCap />
                </span>
                <span className="font-bold text-foreground">{groupCode}</span>
              </div>
            )}
            {teachers && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <UserIcon />
                </span>
                <span className="font-bold text-foreground">{teachers}</span>
              </div>
            )}
            {rooms && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-accent-foreground">
                  <MapPinIcon />
                </span>
                <span className="font-bold text-foreground">{rooms}</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** A single (day × period) grid cell. */
function SlotCell({
  lessons,
  cohortShort,
  hasLeftBorder,
  hasTopBorder,
  style,
}: {
  lessons: LessonItem[];
  cohortShort?: string;
  hasLeftBorder: boolean;
  hasTopBorder: boolean;
  style?: CSSProperties;
}) {
  const base = cn(
    'overflow-hidden',
    hasLeftBorder && 'border-border border-l',
    hasTopBorder && 'border-border border-t'
  );

  if (lessons.length === 0) {
    return <div className={base} style={style} />;
  }

  if (lessons.length === 1) {
    return (
      <div className={base} style={style}>
        <LessonEntry
          cohortShort={cohortShort}
          half={false}
          lesson={lessons[0] as LessonItem}
        />
      </div>
    );
  }

  return (
    <div className={cn(base, 'flex flex-col')} style={style}>
      {lessons.map((lesson, idx) => (
        <Fragment key={lesson.id ?? idx}>
          {idx > 0 && (
            <div className="shrink-0 border-border border-t border-dashed" />
          )}
          <div className="min-h-0 flex-1">
            <LessonEntry cohortShort={cohortShort} half lesson={lesson} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * The secondary timetable view: a print-like class timetable card.
 * Days are rows, periods are columns, and lessons are grouped by slot with
 * alternating-week (A/B) split cells shown via a dashed divider. The card uses
 * the surrounding theme colours (no forced paper background or outer frame)
 * and only renders the period span that actually holds lessons.
 */
export function TimetableCardView({
  lessons,
  periods,
  header,
  language,
}: Props) {
  const { t } = useTranslation();

  const model = useMemo(
    () => buildSecondaryModel(lessons, periods, language),
    [lessons, periods, language]
  );

  const columnCount = model.periods.length;
  const gridTemplateColumns = `${DAY_LABEL_WIDTH}px repeat(${columnCount}, ${PERIOD_COLUMN_WIDTH}px)`;
  const gridTemplateRows = `${HEADER_ROW_HEIGHT}px repeat(${model.days.length}, ${DAY_ROW_HEIGHT}px)`;
  const gridWidth = DAY_LABEL_WIDTH + columnCount * PERIOD_COLUMN_WIDTH;
  const cohortShort = header.classCode;

  if (model.periods.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-muted-foreground text-sm">
        {t('timetable.noLessonsOnThisDay')}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="mx-auto w-fit overflow-hidden rounded-xl border border-border bg-card"
        style={{ minWidth: gridWidth }}
      >
        {/* Grid */}
        <div className="grid" style={{ gridTemplateColumns, gridTemplateRows }}>
          {/* Top-left corner: class code */}
          <div
            className="flex items-center justify-center border-border border-r-2 border-b-2 bg-muted/95 px-1.5"
            style={{ gridColumn: 1, gridRow: 1 }}
          >
            <span className="font-bold text-foreground text-lg leading-tight">
              {header.classCode}
            </span>
          </div>

          {/* Period header row */}
          {model.periods.map((period, i) => (
            <div
              className={cn(
                'flex flex-col items-center justify-center border-border border-b-2 bg-muted/95 px-1',
                i > 0 && 'border-border border-l'
              )}
              key={period.id}
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              <span className="font-bold text-foreground text-sm">
                {period.index}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {[period.startLabel, period.endLabel]
                  .filter(Boolean)
                  .join(' - ')}
              </span>
            </div>
          ))}

          {/* Weekday rows */}
          {model.days.map((day, r) => (
            <Fragment key={day.key}>
              <div
                className={cn(
                  'flex items-center justify-center border-border border-r-2 bg-muted/95 font-bold text-foreground text-lg',
                  r > 0 && 'border-border border-t'
                )}
                style={{ gridColumn: 1, gridRow: r + 2 }}
              >
                {day.label}
              </div>

              {model.periods.map((period, i) => (
                <SlotCell
                  cohortShort={cohortShort}
                  hasLeftBorder={i > 0}
                  hasTopBorder={r > 0}
                  key={`${day.key}-${period.index}`}
                  lessons={model.grid.get(`${day.order}|${period.index}`) ?? []}
                  style={{ gridColumn: i + 2, gridRow: r + 2 }}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
