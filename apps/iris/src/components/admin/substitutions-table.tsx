import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  } | null;
  period: {
    id: string;
    period: number;
    startTime: string;
    endTime: string;
  } | null;
  teachers: {
    id: string;
    name: string;
    short: string;
  }[];
};

type SubstitutionEntry = {
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

type SubstitutionsTableProps = {
  onDelete?: (substitutionId: string) => void;
  onEdit?: (substitution: SubstitutionEntry) => void;
  substitutions: SubstitutionEntry[];
};

type Row = {
  key: string;
  date: string;
  lesson: string;
  className: string;
  time: string;
  classroom: string;
  substituter: string;
  originalTeacher: string;
  substitutionId: string;
  substitution: SubstitutionEntry;
};

const formatTime = (lesson: Lesson, notAvailable: string) => {
  if (!(lesson.period?.startTime && lesson.period?.endTime)) {
    return notAvailable;
  }
  return `${lesson.period.startTime.slice(0, 5)} - ${lesson.period.endTime.slice(0, 5)}`;
};

const resolveName = (
  parts: Array<string | null | undefined>,
  fallback: string
) => {
  const name = parts.filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : fallback;
};

const buildRows = (
  substitutions: SubstitutionEntry[],
  notAvailable: string
): Row[] =>
  substitutions.flatMap((sub) =>
    sub.lessons.map((lesson) => ({
      className:
        lesson.cohorts.length > 0 ? lesson.cohorts.join(', ') : notAvailable,
      classroom:
        lesson.classrooms.length > 0
          ? lesson.classrooms.map((c) => c.name).join(', ')
          : notAvailable,
      date: sub.substitution.date,
      key: `${sub.substitution.id}-${lesson.id}`,
      lesson: lesson.subject?.short ?? notAvailable,
      originalTeacher:
        lesson.teachers.length > 0
          ? lesson.teachers.map((t) => t.name).join(', ')
          : notAvailable,
      substituter: resolveName(
        [sub.teacher?.firstName, sub.teacher?.lastName],
        notAvailable
      ),
      substitution: sub,
      substitutionId: sub.substitution.id,
      time: formatTime(lesson, notAvailable),
    }))
  );

export function SubstitutionsTable({
  onDelete,
  onEdit,
  substitutions,
}: SubstitutionsTableProps) {
  const { t } = useTranslation();
  const notAvailable = t('substitutionsAdmin.notAvailable');
  const rows = buildRows(substitutions, notAvailable);
  const uniqueSubstitutions = new Map<string, SubstitutionEntry>();
  for (const sub of substitutions) {
    uniqueSubstitutions.set(sub.substitution.id, sub);
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] truncate">
              {t('substitutionsAdmin.table.date')}
            </TableHead>
            <TableHead className="w-[80px] truncate">
              {t('substitutionsAdmin.table.lesson')}
            </TableHead>
            <TableHead className="w-[100px] truncate">
              {t('substitutionsAdmin.table.class')}
            </TableHead>
            <TableHead className="w-[100px] truncate">
              {t('substitutionsAdmin.table.time')}
            </TableHead>
            <TableHead className="w-[150px] truncate">
              {t('substitutionsAdmin.table.classroom')}
            </TableHead>
            <TableHead className="w-[150px] truncate">
              {t('substitutionsAdmin.table.substituter')}
            </TableHead>
            <TableHead className="w-[150px] truncate">
              {t('substitutionsAdmin.table.originalTeacher')}
            </TableHead>
            <TableHead className="w-[200px] truncate">
              {t('common.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={8}>
                {t('substitutionsAdmin.noSubstitutions')}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row, index) => {
            const isFirstRowForSubstitution =
              index === 0 ||
              rows[index - 1]?.substitutionId !== row.substitutionId;
            const rowSpan = rows.filter(
              (r) => r.substitutionId === row.substitutionId
            ).length;

            return (
              <TableRow key={row.key}>
                <TableCell className="truncate font-medium">
                  {row.date}
                </TableCell>
                <TableCell className="truncate">{row.lesson}</TableCell>
                <TableCell className="truncate">{row.className}</TableCell>
                <TableCell className="truncate">{row.time}</TableCell>
                <TableCell className="truncate">{row.classroom}</TableCell>
                <TableCell className="truncate">{row.substituter}</TableCell>
                <TableCell className="truncate">
                  {row.originalTeacher}
                </TableCell>
                {isFirstRowForSubstitution && (
                  <TableCell className="truncate" rowSpan={rowSpan}>
                    <div className="flex gap-2">
                      {onEdit && (
                        <Button
                          onClick={() => onEdit(row.substitution)}
                          size="sm"
                          variant="outline"
                        >
                          {t('substitutionsAdmin.edit')}
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          onClick={() => onDelete(row.substitutionId)}
                          size="sm"
                          variant="destructive"
                        >
                          {t('substitutionsAdmin.delete')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
