import type { InferResponseType } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatLocalizedDate } from '@/utils/date-locale';
import type { api } from '@/utils/hc';

type TimetableProps = {
  data: Subs[];
  movedLessons?: MovedLessonItem[];
};

type SubstitutionsResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;

type Subs = NonNullable<SubstitutionsResponse['data']>[number];
type Lesson = NonNullable<Subs['lessons'][number]>;

type MovedLessonApiResponse = InferResponseType<
  typeof api.timetable.movedLessons.$get
>;
type MovedLessonItem = NonNullable<MovedLessonApiResponse['data']>[number];

function LessonRow({
  lesson,
  substituter,
}: {
  lesson: Lesson;
  substituter: string;
}) {
  const { t } = useTranslation();
  const notAvailable = t('substitution.notAvailable');
  const isCancelled = substituter === '';

  return (
    <>
      <TableCell className="font-medium">
        {lesson.subject?.short ?? 'N/A'}
      </TableCell>
      <TableCell>
        {lesson.cohorts && lesson.cohorts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {lesson.cohorts.map((cohort) => (
              <Badge className="text-xs" key={cohort} variant="secondary">
                {cohort}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        {lesson.period?.startTime && lesson.period?.endTime ? (
          <span className="font-medium">
            {lesson.period.startTime.slice(0, 5)} –{' '}
            {lesson.period.endTime.slice(0, 5)}
          </span>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        {lesson.classrooms && lesson.classrooms.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {lesson.classrooms.map((c) => (
              <Badge className="text-xs" key={c.id} variant="outline">
                {c.short || c.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        {isCancelled && (
          <Badge className="text-xs" variant="destructive">
            {t('substitution.cancelled')}
          </Badge>
        )}
        {!isCancelled && substituter !== '' && (
          <span className="font-medium text-green-700 dark:text-green-400">
            {substituter}
          </span>
        )}
        {!isCancelled && substituter === '' && (
          <span className="text-muted-foreground">
            {t('substitution.noSubstituter')}
          </span>
        )}
      </TableCell>
      <TableCell>
        {lesson.teachers && lesson.teachers.length > 0 ? (
          <div className="text-sm">
            {lesson.teachers.map((teacher) => teacher.name).join(', ')}
          </div>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
    </>
  );
}

function MovedLessonRow({ movedLesson }: { movedLesson: MovedLessonItem }) {
  const { t } = useTranslation();
  const notAvailable = t('substitution.notAvailable');

  return (
    <>
      <TableCell className="font-medium">
        {movedLesson.lessons && movedLesson.lessons.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {movedLesson.lessons.map((lessonId) => (
              <Badge className="text-xs" key={lessonId} variant="secondary">
                {lessonId}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className="text-xs" variant="outline">
          {t('movedLesson.moved')}
        </Badge>
      </TableCell>
      <TableCell>
        {movedLesson.period?.startTime && movedLesson.period?.endTime ? (
          <span className="font-medium">
            {movedLesson.period.startTime.slice(0, 5)} –{' '}
            {movedLesson.period.endTime.slice(0, 5)}
          </span>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        {movedLesson.classroom ? (
          <Badge className="text-xs" variant="outline">
            {movedLesson.classroom.short || movedLesson.classroom.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        {movedLesson.dayDefinition ? (
          <span className="font-medium text-blue-700 dark:text-blue-400">
            {movedLesson.dayDefinition.name} ({movedLesson.dayDefinition.short})
          </span>
        ) : (
          <span className="text-muted-foreground">{notAvailable}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
    </>
  );
}

function LessonReturn(data: Subs[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return data
    .filter((sub) => new Date(sub.substitution.date) >= today)
    .flatMap((sub) =>
      sub.lessons
        .filter((lesson) => lesson !== null)
        .map((lesson) => (
          <TableRow
            className="border-accent/10 transition-colors hover:bg-accent/5"
            key={`${sub.substitution.id}-${lesson.id}`}
          >
            <LessonRow
              lesson={lesson}
              substituter={`${sub.teacher?.firstName ?? ''} ${sub.teacher?.lastName ?? ''}`.trim()}
            />
          </TableRow>
        ))
    );
}

function MovedLessonReturn(data: MovedLessonItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return data
    .filter((ml) => new Date(ml.movedLesson.date) >= today)
    .map((ml) => (
      <TableRow
        className="border-accent/10 transition-colors hover:bg-accent/5"
        key={ml.movedLesson.id}
      >
        <MovedLessonRow movedLesson={ml} />
      </TableRow>
    ));
}

export function SubsV({ data, movedLessons = [] }: TimetableProps) {
  const { i18n, t } = useTranslation();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureSubstitutions =
    data &&
    data.length > 0 &&
    data[0]?.substitution.date &&
    new Date(data[0].substitution.date) >= today;

  if (!hasFutureSubstitutions) {
    return null;
  }

  const firstSub = data[0];
  if (!firstSub) {
    return null;
  }

  return (
    <Card className="w-full border-accent/50 bg-linear-to-br from-background to-accent/5 shadow-sm">
      <CardHeader className="border-accent/20 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-semibold text-foreground text-lg">
              {formatLocalizedDate(firstSub.substitution.date, i18n.language, {
                day: '2-digit',
                month: 'long',
                weekday: 'long',
                year: 'numeric',
              })}
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              {t('substitution.affectedLessons')}
            </p>
          </div>
          <Badge className="h-fit" variant="outline">
            {data.filter((sub) => sub.lessons.some((l) => l !== null)).length +
              movedLessons.filter(
                (ml) => new Date(ml.movedLesson.date) >= today
              ).length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-lg border border-accent/20">
          <Table>
            <TableHeader>
              <TableRow className="border-accent/20 bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-foreground">
                  {t('substitution.affectedLessons')}
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  {t('substitution.cohorts')}
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  {t('timetable.time')}
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  {t('timetable.filterByClassroom')}
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  {t('substitution.substituteTeacher')}
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  {t('timetable.teacherFallback')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LessonReturn(data).length > 0 ||
              MovedLessonReturn(movedLessons).length > 0 ? (
                <>
                  {LessonReturn(data)}
                  {MovedLessonReturn(movedLessons)}
                </>
              ) : (
                <TableRow>
                  <TableCell
                    className="text-center text-muted-foreground"
                    colSpan={6}
                  >
                    {t('substitution.noLessons')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
