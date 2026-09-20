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
    .filter((sub) => new Date(sub.substitution.date) >= today)
    .flatMap((sub) =>
      sub.lessons
        .filter((lesson): lesson is Lesson => lesson !== null)
        .filter(
          (lesson) =>
            !cohortFilter || (lesson.cohorts?.includes(cohortFilter) ?? false)
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

type MovedLessonRow = { lesson: Lesson; ml: MovedLessonItem };

function getMovedLessonRows(data: MovedLessonItem[]): MovedLessonRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = data
    .filter((ml) => new Date(ml.movedLesson.date) >= today)
    .flatMap((ml) => ml.lessons.map((lesson) => ({ lesson, ml })));

  rows.sort(
    (a, b) =>
      (a.lesson.period?.period ?? Number.MAX_SAFE_INTEGER) -
      (b.lesson.period?.period ?? Number.MAX_SAFE_INTEGER)
  );

  return rows;
}

function substituterLabel(sub: Subs): string {
  return `${sub.teacher?.firstName ?? ''} ${sub.teacher?.lastName ?? ''}`.trim();
}

// --- shared cell content ---------------------------------------------------

function Subject({
  lesson,
  className,
}: {
  lesson: Lesson;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      {lesson.subject?.short ??
        lesson.subject?.name ??
        t('substitution.notAvailable')}
    </span>
  );
}

function CohortsCell({ cohorts }: { cohorts: string[] }) {
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
        <Badge className="text-xs" key={cohort} variant="outline">
          {cohort}
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

function TeachersCell({ teachers }: { teachers: Lesson['teachers'] }) {
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
  lesson,
  movedTarget,
}: {
  lesson: Lesson;
  movedTarget: MovedTarget;
}) {
  const { t } = useTranslation();
  const originalPeriod = lesson.period;
  const targetPeriod = movedTarget.period ?? null;

  if (originalPeriod) {
    if (targetPeriod && targetPeriod.id !== originalPeriod.id) {
      return (
        <span className="font-medium">
          {formatPeriodLabel(originalPeriod)} →{' '}
          {formatPeriodLabel(targetPeriod)}
        </span>
      );
    }
    return (
      <span className="font-medium">{formatPeriodLabel(originalPeriod)}</span>
    );
  }
  if (targetPeriod) {
    return (
      <span className="font-medium">{formatPeriodLabel(targetPeriod)}</span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {t('substitution.notAvailable')}
    </span>
  );
}

function MovedRoomCell({
  lesson,
  movedTarget,
}: {
  lesson: Lesson;
  movedTarget: MovedTarget;
}) {
  const originalRooms = lesson.classrooms ?? [];
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
        <Subject lesson={lesson} />
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
  const { lesson, ml } = row;
  const movedTarget: MovedTarget = {
    classroom: ml.classroom,
    day: ml.dayDefinition,
    period: ml.period,
  };
  return (
    <TableRow className="border-accent/10 transition-colors hover:bg-accent/5">
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          <Subject lesson={lesson} />
          <Badge className="text-xs" variant="secondary">
            {t('movedLesson.moved')}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <CohortsCell cohorts={lesson.cohorts} />
      </TableCell>
      <TableCell>
        <MovedTimeCell lesson={lesson} movedTarget={movedTarget} />
      </TableCell>
      <TableCell>
        <MovedRoomCell lesson={lesson} movedTarget={movedTarget} />
      </TableCell>
      <TableCell>
        <TeachersCell teachers={lesson.teachers} />
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
      <TableCell>
        <CommentCell comment={ml.movedLesson.comment} />
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
        <Subject className="font-semibold" lesson={lesson} />
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
  const { lesson, ml } = row;
  const accent = ACCENT.moved;
  const originalPeriod = lesson.period;
  const targetPeriod = ml.period ?? null;
  const targetDay = ml.dayDefinition;

  return (
    <MobileRow className={cn(accent.rail, accent.soft, accent.border)}>
      <div className="flex items-start justify-between gap-2">
        <Subject className="font-semibold" lesson={lesson} />
        {originalPeriod ? (
          <span className="shrink-0 text-muted-foreground">
            {formatPeriodLabel(originalPeriod)}
          </span>
        ) : (
          <span className="shrink-0 text-muted-foreground">
            {t('substitution.notAvailable')}
          </span>
        )}
      </div>
      {lesson.cohorts.length > 0 && (
        <div className="mt-1">
          <CohortsCell cohorts={lesson.cohorts} />
        </div>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Field label={t('timetable.filterByClassroom')}>
          <MovedRoomCell
            lesson={lesson}
            movedTarget={{
              classroom: ml.classroom,
              day: ml.dayDefinition,
              period: ml.period,
            }}
          />
        </Field>
        <Field label={t('timetable.teacherFallback')}>
          <TeachersCell teachers={lesson.teachers} />
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
          (!originalPeriod || targetPeriod.id !== originalPeriod.id) && (
            <Field label={t('movedLesson.targetPeriod')}>
              <span>{formatPeriodLabel(targetPeriod)}</span>
            </Field>
          )}
      </dl>
      {ml.movedLesson.comment && (
        <p className="mt-2 whitespace-pre-wrap text-xs">
          {ml.movedLesson.comment}
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
  const { i18n, t } = useTranslation();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Prefer explicit date prop; fall back to first sub's date
  const cardDate = dateProp ?? data[0]?.substitution.date;

  const hasContent =
    !!cardDate &&
    new Date(cardDate) >= today &&
    (data.length > 0 ||
      movedLessons.some((ml) => new Date(ml.movedLesson.date) >= today));

  if (!hasContent) {
    return null;
  }

  const substitutionRows = getSubstitutionRows(data, cohortFilter);
  const movedRows = getMovedLessonRows(movedLessons);

  const subsCount = substitutionRows.length;
  const movedCount = movedRows.length;
  const hasSections = subsCount > 0 || movedCount > 0;

  const dateLabel = formatLocalizedDate(cardDate, i18n.language, {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });

  return (
    <Card className="w-full overflow-hidden border-accent/50 bg-linear-to-br from-background to-accent/5 shadow-sm">
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
      <CardContent className="p-0">
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
                    <MovedTableRow
                      key={`${row.ml.movedLesson.id}-${row.lesson.id}`}
                      row={row}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 p-3 sm:hidden">
              {movedRows.map((row) => (
                <MovedMobileRow
                  key={`${row.ml.movedLesson.id}-${row.lesson.id}`}
                  row={row}
                />
              ))}
            </div>
          </section>
        )}
        {!hasSections && (
          <p className="p-6 text-center text-muted-foreground text-sm">
            {t('substitution.noLessons')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
