import type { InferResponseType } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { api } from '@/utils/hc';

type TimetableProps = {
  data: Subs[];
};

type SubstitutionsResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;

type Subs = NonNullable<SubstitutionsResponse['data']>[number];
type Lesson = NonNullable<Subs['lessons'][number]>;

function LessonRow({
  lesson,
  substituter,
}: {
  lesson: Lesson;
  substituter: string;
}) {
  const { t } = useTranslation();
  const notAvailable = t('substitution.notAvailable');

  return (
    <>
      <TableCell>{lesson.subject?.short ?? 'N/A'}</TableCell>
      <TableCell>
        {lesson.cohorts && lesson.cohorts.length > 0
          ? lesson.cohorts.join(', ')
          : notAvailable}
      </TableCell>
      <TableCell>
        {lesson.period?.startTime && lesson.period?.endTime
          ? `${lesson.period.startTime.slice(0, 5)} - ${lesson.period.endTime.slice(0, 5)}`
          : notAvailable}
      </TableCell>
      <TableCell>
        {lesson.classrooms && lesson.classrooms.length > 0
          ? lesson.classrooms.map((c) => c.name).join(', ')
          : notAvailable}
      </TableCell>
      <TableCell>
        {substituter !== '' ? substituter : t('substitution.noSubstituter')}
      </TableCell>
      <TableCell>
        {lesson.teachers && lesson.teachers.length > 0
          ? lesson.teachers.map((teacher) => teacher.name).join(', ')
          : notAvailable}
      </TableCell>
    </>
  );
}

function LessonReturn(data: Subs[]) {
  return data.flatMap((sub) =>
    sub.lessons
      .filter((lesson) => lesson !== null)
      .map((lesson) => (
        <TableRow key={`${sub.substitution.id}-${lesson.id}`}>
          <LessonRow
            lesson={lesson}
            substituter={`${sub.teacher?.firstName ?? ''} ${sub.teacher?.lastName ?? ''}`.trim()}
          />
        </TableRow>
      ))
  );
}

export function SubsV({ data }: TimetableProps) {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return null;
  }
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {t('substitution.cardTitle', {
            date: data[0]?.substitution.date.split('T')[0],
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('substitution.affectedLessons')}</TableHead>
              <TableHead>{t('substitution.cohorts')}</TableHead>
              <TableHead>{t('timetable.time')}</TableHead>
              <TableHead>{t('timetable.filterByClassroom')}</TableHead>
              <TableHead>{t('substitution.substituteTeacher')}</TableHead>
              <TableHead>{t('timetable.teacherFallback')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{LessonReturn(data)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
