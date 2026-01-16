import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

type TimetableProps = {
  data: Subs[];
};

type Subs = {
  lessons: string[];
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

type Lesson = {
  id: string;
  subject: {
    id: string;
    name: string;
    short: string;
  };
  classrooms: {
    id: string;
    name: string;
    short: string;
  }[];
  day: {
    id: string;
    name: string;
    short: string;
    days: string[];
    createdAt: string;
    updatedAt: string;
  };
  period: {
    id: string;
    period: number;
    startTime: string;
    endTime: string;
  };
  periodsPerWeek: number;
  substitutionCohortName: string | null;
  teachers: {
    id: string;
    name: string;
    short: string;
  }[];
  termDefinitionId: string | null;
  weeksDefinitionId: string;
};

function LessonRow({
  lessonId,
  substituter,
}: {
  lessonId: string;
  substituter: string | null;
}) {
  const { isPending: sessionPending } = authClient.useSession();
  const lessonQuery = useQuery({
    enabled: !sessionPending,
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.lessons.getForId[':lessonId'].$get({
          param: { lessonId },
        })
      );
      if (!(res.success && res.data)) {
        throw new Error('Failed to load lesson');
      }

      return res.data as Lesson;
    },
    queryKey: ['lesson', lessonId],
  });

  if (lessonQuery.isLoading) {
    return (
      <>
        <TableCell>Loading...</TableCell>
        <TableCell>Loading...</TableCell>
        <TableCell>Loading...</TableCell>
        <TableCell>Loading...</TableCell>
        <TableCell>Loading...</TableCell>
        <TableCell>Loading...</TableCell>
      </>
    );
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <>
        <TableCell>Error</TableCell>
        <TableCell>Error</TableCell>
        <TableCell>Error</TableCell>
        <TableCell>Error</TableCell>
        <TableCell>Error</TableCell>
        <TableCell>Error</TableCell>
      </>
    );
  }

  const lesson = lessonQuery.data;

  return (
    <>
      <TableCell>{lesson.subject?.short ?? 'N/A'}</TableCell>
      <TableCell>{lesson.substitutionCohortName ?? 'N/A'}</TableCell>
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
  return data.map((sub) =>
    sub.lessons.map((lesson) => (
      <TableRow key={`${sub.substitution.id}-${lesson}`}>
        <LessonRow
          lessonId={lesson}
          substituter={`${sub.teacher?.firstName} ${sub.teacher?.lastName}`}
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
