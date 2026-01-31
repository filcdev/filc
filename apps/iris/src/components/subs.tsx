import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TimetableProps = {
  data: Subs[];
};

type Lesson = {
  id: string;
  subject: {
    id: string;
    name: string;
    short: string;
  } | null;
  classrooms: {
    id: string;
    name: string;
    short: string;
  }[];
  cohorts: string[];
  day: {
    id: string;
    name: string;
    short: string;
    days: string[];
    createdAt: string;
    updatedAt: string;
  } | null;
  period: {
    id: string;
    period: number;
    startTime: string;
    endTime: string;
  } | null;
  periodsPerWeek: number;
  teachers: {
    id: string;
    name: string;
    short: string;
  }[];
  termDefinitionId: string | null;
  weeksDefinitionId: string;
};

type Subs = {
  lessons: Lesson[];
  substitution: {
    date: string;
    id: string;
    substituter: string | null;
  };
  teacher: {
    firstName: string;
    gender: string | null;
    id: string;
    lastName: string;
    short: string;
    userId: string | null;
  } | null;
};

function LessonRow({
  lesson,
  substituter,
}: {
  lesson: Lesson;
  substituter: string | null;
}) {
  return (
    <>
      <TableCell>{lesson.subject?.short ?? 'N/A'}</TableCell>
      <TableCell>
        {lesson.cohorts && lesson.cohorts.length > 0
          ? lesson.cohorts.join(', ')
          : 'N/A'}
      </TableCell>
      <TableCell>
        {lesson.period?.startTime && lesson.period?.endTime
          ? `${lesson.period.startTime.slice(0, 5)} - ${lesson.period.endTime.slice(0, 5)}`
          : 'N/A'}
      </TableCell>
      <TableCell>
        {lesson.classrooms && lesson.classrooms.length > 0
          ? lesson.classrooms.map((c) => c.name).join(', ')
          : 'N/A'}
      </TableCell>
      <TableCell>
        {substituter !== 'undefined undefined' ? substituter : 'N/A'}
      </TableCell>
      <TableCell>
        {lesson.teachers && lesson.teachers.length > 0
          ? lesson.teachers.map((t) => t.name).join(', ')
          : 'N/A'}
      </TableCell>
    </>
  );
}

function LessonReturn(data: Subs[]) {
  return data.flatMap((sub) =>
    sub.lessons.map((lesson) => (
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
  if (!data || data.length === 0) {
    return null;
  }
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Substitution on {data[0]?.substitution.date}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Classroom</TableHead>
              <TableHead>Substituter</TableHead>
              <TableHead>Original Teacher</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{LessonReturn(data)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
