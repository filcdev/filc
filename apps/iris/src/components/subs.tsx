import { Badge } from '@filcdev/ui/components/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { cn } from '@filcdev/ui/lib/utils';
import { ArrowRightLeft, type LucideIcon, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MovedLessonItem } from '@/hooks/moved-lessons';
import type { SubstitutionItem as Subs } from '@/hooks/substitutions';
import {
  formatLocalizedDate,
  getLocalizedWeekdayName,
  parseDateOnly,
} from '@/utils/date-locale';
import { formatPeriodLabel } from '@/utils/period';

type TimetableProps = {
  data: Subs[];
  movedLessons?: MovedLessonItem[];
  /** When set, only lessons for this cohort are shown in the table. */
  cohortFilter?: string;
  /** Explicit date string (ISO) used when `data` is empty (moved-lessons-only card). */
  date?: string;
};

type Lesson = NonNullable<Subs['lessons'][number]>;

type MovedTarget = {
  day: MovedLessonItem['dayDefinition'];
  period: MovedLessonItem['period'];
  classroom: MovedLessonItem['classroom'];
};

const ACCENT = {
  moved: {
    badge: 'border-warning/30 bg-warning/20 text-amber-700 dark:text-amber-300',
    border: 'border-warning/30',
    rail: 'border-l-warning',
    soft: 'bg-warning/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
  substitution: {
    badge: 'border-primary/20 bg-primary/15 text-primary',
    border: 'border-primary/20',
    rail: 'border-l-primary',
    soft: 'bg-primary/5',
    text: 'text-primary',
  },
} as const;

type Accent = (typeof ACCENT)[keyof typeof ACCENT];

// --- data getters ---------------------------------------------------------

type SubstitutionRow = { lesson: Lesson; sub: Subs };

function getSubstitutionRows(
  data: Subs[],
  cohortFilter?: string
): SubstitutionRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = data
    .filter((sub) => parseDateOnly(sub.substitution.date) >= today)
    .flatMap((sub) =>
      sub.lessons
        .filter((lesson): lesson is Lesson => lesson !== null)
        .filter(
          (lesson) =>
            !cohortFilter ||
            (lesson.cohorts?.some((c) => c.name === cohortFilter) ?? false)
        )
        .map((lesson) => ({ lesson, sub }))
    );

  rows.sort(
    (a, b) =>
      (a.lesson.period?.period ?? Number.MAX_SAFE_INTEGER) -
      (b.lesson.period?.period ?? Number.MAX_SAFE_INTEGER)
  );

  return rows;
}

/** A display projection of a cohort/teacher/classroom: id plus the labels the
 * public card renders. `short` is optional because a manual source only
 * guarantees `id` and `name` for its cohorts/teachers. */
type EntityRef = { id: string; name: string; short?: string };

type MovedLessonRow = {
  key: string;
  ml: MovedLessonItem;
  subjectLabel: string | null;
  cohorts: EntityRef[];
  teachers: EntityRef[];
  originalPeriod: Lesson['period'];
  originalClassrooms: EntityRef[];
};

function getMovedLessonRows(data: MovedLessonItem[]): MovedLessonRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = data
    .filter((ml) => parseDateOnly(ml.movedLesson.date) >= today)
    .flatMap((ml): MovedLessonRow[] => {
      if (ml.manual) {
        return [
          {
            cohorts: ml.manual.cohorts,
            key: `${ml.movedLesson.id}-manual`,
            ml,
            originalClassrooms: ml.manual.sourceRoom
              ? [ml.manual.sourceRoom]
              : [],
            originalPeriod: null,
            subjectLabel:
              ml.manual.subject?.short ?? ml.manual.subject?.name ?? null,
            teachers: ml.manual.teachers,
          },
        ];
      }
      return ml.lessons.map((lesson) => ({
        cohorts: lesson.cohorts,
        key: `${ml.movedLesson.id}-${lesson.id}`,
        ml,
        originalClassrooms: lesson.classrooms,
        originalPeriod: lesson.period,
        subjectLabel: lesson.subject?.short ?? lesson.subject?.name ?? null,
        teachers: lesson.teachers,
      }));
    });

  rows.sort(
    (a, b) =>
      (a.originalPeriod?.period ?? Number.MAX_SAFE_INTEGER) -
      (b.originalPeriod?.period ?? Number.MAX_SAFE_INTEGER)
  );

  return rows;
}

function substituterLabel(sub: Subs): string {
  return `${sub.teacher?.firstName ?? ''} ${sub.teacher?.lastName ?? ''}`.trim();
}

// --- shared cell content ---------------------------------------------------

function Subject({
  subjectLabel,
  className,
}: {
  subjectLabel: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      {subjectLabel ?? t('substitution.notAvailable')}
    </span>
  );
}

function CohortsCell({ cohorts }: { cohorts: EntityRef[] }) {
  const { t } = useTranslation();
  if (cohorts.length === 0) {
    return (
      <span className="text-muted-foreground">
        {t('substitution.notAvailable')}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {cohorts.map((cohort) => (
        <Badge className="text-xs" key={cohort.id} variant="outline">
          {cohort.name}
        </Badge>
      ))}
    </div>
  );
}

function SubstitutionTime({
  lesson,
  className,
}: {
  lesson: Lesson;
  className?: string;
}) {
  const { t } = useTranslation();
  if (lesson.period?.startTime && lesson.period?.endTime) {
    return (
      <span className={className}>
        {lesson.period.startTime.slice(0, 5)} –{' '}
        {lesson.period.endTime.slice(0, 5)}
        {', '}
        {lesson.period.period}. {t('substitution.period')}
      </span>
    );
  }
  return (
    <span className={cn('text-muted-foreground', className)}>
      {t('substitution.notAvailable')}
    </span>
  );
}

function ClassroomsCell({ classrooms }: { classrooms: Lesson['classrooms'] }) {
  const { t } = useTranslation();
  if (classrooms.length === 0) {
    return (
      <span className="text-muted-foreground">
        {t('substitution.notAvailable')}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {classrooms.map((c) => (
        <Badge className="text-xs" key={c.id} variant="outline">
          {c.short || c.name}
        </Badge>
      ))}
    </div>
  );
}

function TeachersCell({ teachers }: { teachers: EntityRef[] }) {
  const { t } = useTranslation();
  if (teachers.length === 0) {
    return (
      <span className="text-muted-foreground">
        {t('substitution.notAvailable')}
      </span>
    );
  }
  return <span>{teachers.map((teacher) => teacher.name).join(', ')}</span>;
}

function SubstituterCell({ substituter }: { substituter: string }) {
  const { t } = useTranslation();
  if (substituter === '') {
    return (
      <Badge className="text-xs" variant="destructive">
        {t('substitution.cancelled')}
      </Badge>
    );
  }
  return (
    <span className="font-medium text-green-700 dark:text-green-400">
      {substituter}
    </span>
  );
}

function CommentCell({ comment }: { comment?: string | null }) {
  if (comment) {
    return <span className="whitespace-pre-wrap text-sm">{comment}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

function MovedTimeCell({
  originalPeriod,
  targetPeriod,
}: {
  originalPeriod: Lesson['period'];
  targetPeriod: MovedLessonItem['period'];
}) {
  const { t } = useTranslation();

  let periodLabel: string | null = null;
  if (originalPeriod && targetPeriod && targetPeriod.id !== originalPeriod.id) {
    periodLabel = `${formatPeriodLabel(originalPeriod, t('substitution.period'))} → ${formatPeriodLabel(targetPeriod, t('substitution.period'))}`;
  } else if (originalPeriod) {
    periodLabel = formatPeriodLabel(originalPeriod, t('substitution.period'));
  } else if (targetPeriod) {
    periodLabel = formatPeriodLabel(targetPeriod, t('substitution.period'));
  }

  if (!periodLabel) {
    return (
      <span className="text-muted-foreground">
        {t('substitution.notAvailable')}
      </span>
    );
  }

  return <span className="font-medium">{periodLabel}</span>;
}

function MovedRoomCell({
  originalClassrooms,
  movedTarget,
}: {
  originalClassrooms: EntityRef[];
  movedTarget: MovedTarget;
}) {
  const originalRooms = originalClassrooms;
  const targetRoom = movedTarget.classroom ?? null;

  if (originalRooms.length === 0 && !targetRoom) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {originalRooms.length > 0 && (
        <span>{originalRooms.map((c) => c.short || c.name).join(', ')}</span>
      )}
      {originalRooms.length > 0 && targetRoom && (
        <span className="text-muted-foreground">→</span>
      )}
      {targetRoom && (
        <Badge
          className="border-warning/40 bg-transparent text-amber-700 text-xs dark:text-amber-300"
          variant="outline"
        >
          {targetRoom.short || targetRoom.name}
        </Badge>
      )}
    </div>
  );
}

// --- desktop rows ----------------------------------------------------------

function SubstitutionTableRow({ row }: { row: SubstitutionRow }) {
  const { lesson, sub } = row;
  return (
    <TableRow className="border-accent/10 transition-colors hover:bg-accent/5">
      <TableCell className="font-medium">
        <Subject
          subjectLabel={lesson.subject?.short ?? lesson.subject?.name ?? null}
        />
      </TableCell>
      <TableCell>
        <CohortsCell cohorts={lesson.cohorts} />
      </TableCell>
      <TableCell>
        <SubstitutionTime className="font-medium" lesson={lesson} />
      </TableCell>
      <TableCell>
        <ClassroomsCell classrooms={lesson.classrooms} />
      </TableCell>
      <TableCell>
        <TeachersCell teachers={lesson.teachers} />
      </TableCell>
      <TableCell>
        <SubstituterCell substituter={substituterLabel(sub)} />
      </TableCell>
      <TableCell>
        <CommentCell comment={sub.substitution.comment} />
      </TableCell>
    </TableRow>
  );
}

function MovedTableRow({ row }: { row: MovedLessonRow }) {
  const { t } = useTranslation();
  const movedTarget: MovedTarget = {
    classroom: row.ml.classroom,
    day: row.ml.dayDefinition,
    period: row.ml.period,
  };
  return (
    <TableRow className="border-accent/10 transition-colors hover:bg-accent/5">
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          <Subject subjectLabel={row.subjectLabel} />
          <Badge className="text-xs" variant="secondary">
            {t('movedLesson.moved')}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <CohortsCell cohorts={row.cohorts} />
      </TableCell>
      <TableCell>
        <MovedTimeCell
          originalPeriod={row.originalPeriod}
          targetPeriod={movedTarget.period}
        />
      </TableCell>
      <TableCell>
        <MovedRoomCell
          movedTarget={movedTarget}
          originalClassrooms={row.originalClassrooms}
        />
      </TableCell>
      <TableCell>
        <TeachersCell teachers={row.teachers} />
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
      <TableCell>
        <CommentCell comment={row.ml.movedLesson.comment} />
      </TableCell>
    </TableRow>
  );
}

// --- mobile rows -----------------------------------------------------------

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function MobileRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('rounded-r-lg border border-l-4 p-3', className)}>
      {children}
    </div>
  );
}

function SubstitutionMobileRow({ row }: { row: SubstitutionRow }) {
  const { t } = useTranslation();
  const { lesson, sub } = row;
  const substituter = substituterLabel(sub);
  const accent = ACCENT.substitution;

  return (
    <MobileRow
      className={
        substituter === ''
          ? 'border-destructive/20 border-l-destructive bg-destructive/5'
          : cn(accent.rail, accent.soft, accent.border)
      }
    >
      <div className="flex items-start justify-between gap-2">
        <Subject
          className="font-semibold"
          subjectLabel={lesson.subject?.short ?? lesson.subject?.name ?? null}
        />
        <SubstitutionTime
          className="shrink-0 text-muted-foreground"
          lesson={lesson}
        />
      </div>
      {lesson.cohorts.length > 0 && (
        <div className="mt-1">
          <CohortsCell cohorts={lesson.cohorts} />
        </div>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Field label={t('timetable.filterByClassroom')}>
          <ClassroomsCell classrooms={lesson.classrooms} />
        </Field>
        <Field label={t('timetable.teacherFallback')}>
          <TeachersCell teachers={lesson.teachers} />
        </Field>
        <Field label={t('substitution.substituteTeacher')}>
          <SubstituterCell substituter={substituter} />
        </Field>
      </dl>
      {sub.substitution.comment && (
        <p className="mt-2 whitespace-pre-wrap text-xs">
          {sub.substitution.comment}
        </p>
      )}
    </MobileRow>
  );
}

function MovedMobileRow({ row }: { row: MovedLessonRow }) {
  const { i18n, t } = useTranslation();
  const accent = ACCENT.moved;
  const originalPeriod = row.originalPeriod;
  const targetPeriod = row.ml.period ?? null;
  const targetDay = row.ml.dayDefinition;

  // The right-hand "original period" line: the source period, or — for a
  // manual move that has no source — the target period, else not-available.
  let topPeriodLabel: string;
  if (originalPeriod) {
    topPeriodLabel = formatPeriodLabel(
      originalPeriod,
      t('substitution.period')
    );
  } else if (targetPeriod) {
    topPeriodLabel = formatPeriodLabel(targetPeriod, t('substitution.period'));
  } else {
    topPeriodLabel = t('substitution.notAvailable');
  }

  return (
    <MobileRow className={cn(accent.rail, accent.soft, accent.border)}>
      <div className="flex items-start justify-between gap-2">
        <Subject className="font-semibold" subjectLabel={row.subjectLabel} />
        <span className="shrink-0 text-muted-foreground">{topPeriodLabel}</span>
      </div>
      {row.cohorts.length > 0 && (
        <div className="mt-1">
          <CohortsCell cohorts={row.cohorts} />
        </div>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Field label={t('timetable.filterByClassroom')}>
          <MovedRoomCell
            movedTarget={{
              classroom: row.ml.classroom,
              day: row.ml.dayDefinition,
              period: row.ml.period,
            }}
            originalClassrooms={row.originalClassrooms}
          />
        </Field>
        <Field label={t('timetable.teacherFallback')}>
          <TeachersCell teachers={row.teachers} />
        </Field>
        {targetDay && (
          <Field label={t('movedLesson.targetDay')}>
            <span>
              {getLocalizedWeekdayName(
                targetDay.name,
                targetDay.short,
                i18n.language,
                'long'
              )}
            </span>
          </Field>
        )}
        {targetPeriod &&
          originalPeriod &&
          targetPeriod.id !== originalPeriod.id && (
            <Field label={t('movedLesson.targetPeriod')}>
              <span>
                {formatPeriodLabel(targetPeriod, t('substitution.period'))}
              </span>
            </Field>
          )}
      </dl>
      {row.ml.movedLesson.comment && (
        <p className="mt-2 whitespace-pre-wrap text-xs">
          {row.ml.movedLesson.comment}
        </p>
      )}
    </MobileRow>
  );
}

// --- section scaffolding ---------------------------------------------------

function SectionHeader({
  accent,
  icon: Icon,
  title,
  count,
}: {
  accent: Accent;
  icon: LucideIcon;
  title: string;
  count: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-l-4 px-4 py-2',
        accent.rail,
        accent.soft,
        accent.border
      )}
    >
      <Icon className={cn('h-4 w-4', accent.text)} />
      <span className={cn('font-semibold text-sm', accent.text)}>{title}</span>
      <Badge className={cn('ml-auto', accent.badge)}>{count}</Badge>
    </div>
  );
}

function SectionTableHeader({ accent }: { accent: Accent }) {
  const { t } = useTranslation();
  const columns = [
    t('substitution.affectedLessons'),
    t('substitution.cohorts'),
    t('timetable.time'),
    t('timetable.filterByClassroom'),
    t('timetable.teacherFallback'),
    t('substitution.substituteTeacher'),
    t('substitution.comment'),
  ];
  return (
    <TableRow
      className={cn('hover:bg-transparent', accent.soft, accent.border)}
    >
      {columns.map((col) => (
        <TableHead className={cn('font-semibold', accent.text)} key={col}>
          {col}
        </TableHead>
      ))}
    </TableRow>
  );
}

// --- card ------------------------------------------------------------------

export function SubsV({
  data,
  movedLessons = [],
  cohortFilter,
  date: dateProp,
}: TimetableProps) {
  const { i18n } = useTranslation();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Prefer explicit date prop; fall back to first sub's date
  const cardDate = dateProp ?? data[0]?.substitution.date;

  const hasContent =
    !!cardDate &&
    parseDateOnly(cardDate) >= today &&
    (data.length > 0 ||
      movedLessons.some((ml) => parseDateOnly(ml.movedLesson.date) >= today));

  if (!hasContent) {
    return null;
  }

  const substitutionRows = getSubstitutionRows(data, cohortFilter);
  const movedRows = getMovedLessonRows(movedLessons);

  const subsCount = substitutionRows.length;
  const movedCount = movedRows.length;

  const dateLabel = formatLocalizedDate(
    parseDateOnly(cardDate),
    i18n.language,
    {
      day: '2-digit',
      month: 'long',
      weekday: 'long',
      year: 'numeric',
    }
  );

  return (
    <Card className="w-full overflow-hidden border-accent/50 shadow-sm">
      <SubsCardHeader
        cohortFilter={cohortFilter}
        dateLabel={dateLabel}
        movedCount={movedCount}
        subsCount={subsCount}
      />
      <CardContent className="p-0">
        <SubsCardBody
          movedRows={movedRows}
          substitutionRows={substitutionRows}
        />
      </CardContent>
    </Card>
  );
}

/** The card header: the cohort name or date, and a badge per non-empty section. */
function SubsCardHeader({
  cohortFilter,
  dateLabel,
  movedCount,
  subsCount,
}: {
  cohortFilter?: string;
  dateLabel: string;
  movedCount: number;
  subsCount: number;
}) {
  const { t } = useTranslation();
  const hasSections = subsCount > 0 || movedCount > 0;

  return (
    <CardHeader className="border-accent/20 border-b pb-4">
      <CardTitle className="font-semibold text-foreground text-lg">
        {cohortFilter ?? dateLabel}
      </CardTitle>
      {cohortFilter && (
        <p className="text-muted-foreground text-sm">{dateLabel}</p>
      )}
      {hasSections && (
        <div className="mt-1 flex flex-wrap gap-2">
          {subsCount > 0 && (
            <Badge className={ACCENT.substitution.badge}>
              {subsCount} {t('substitution.title')}
            </Badge>
          )}
          {movedCount > 0 && (
            <Badge className={ACCENT.moved.badge}>
              {movedCount} {t('movedLesson.title')}
            </Badge>
          )}
        </div>
      )}
    </CardHeader>
  );
}

/** The card body: one section per non-empty row list, else the empty notice. */
function SubsCardBody({
  movedRows,
  substitutionRows,
}: {
  movedRows: MovedLessonRow[];
  substitutionRows: SubstitutionRow[];
}) {
  const { t } = useTranslation();
  const subsCount = substitutionRows.length;
  const movedCount = movedRows.length;

  if (subsCount === 0 && movedCount === 0) {
    return (
      <p className="p-6 text-center text-muted-foreground text-sm">
        {t('substitution.noLessons')}
      </p>
    );
  }

  return (
    <>
      {subsCount > 0 && (
        <section>
          <SectionHeader
            accent={ACCENT.substitution}
            count={subsCount}
            icon={UserRoundCheck}
            title={t('substitution.title')}
          />
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <SectionTableHeader accent={ACCENT.substitution} />
              </TableHeader>
              <TableBody>
                {substitutionRows.map((row) => (
                  <SubstitutionTableRow
                    key={`${row.sub.substitution.id}-${row.lesson.id}`}
                    row={row}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 p-3 sm:hidden">
            {substitutionRows.map((row) => (
              <SubstitutionMobileRow
                key={`${row.sub.substitution.id}-${row.lesson.id}`}
                row={row}
              />
            ))}
          </div>
        </section>
      )}
      {subsCount > 0 && movedCount > 0 && (
        <div className="border-accent/20 border-t" />
      )}
      {movedCount > 0 && (
        <section>
          <SectionHeader
            accent={ACCENT.moved}
            count={movedCount}
            icon={ArrowRightLeft}
            title={t('movedLesson.title')}
          />
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <SectionTableHeader accent={ACCENT.moved} />
              </TableHeader>
              <TableBody>
                {movedRows.map((row) => (
                  <MovedTableRow key={row.key} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 p-3 sm:hidden">
            {movedRows.map((row) => (
              <MovedMobileRow key={row.key} row={row} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
