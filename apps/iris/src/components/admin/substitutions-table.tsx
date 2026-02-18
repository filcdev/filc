import dayjs from 'dayjs';
import { Pen, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EnrichedLesson = {
  classrooms: { id: string; name: string; short: string }[];
  cohorts: string[];
  day: { id: string; name: string; short: string } | null;
  id: string;
  period: {
    endTime: string;
    id: string;
    period: number;
    startTime: string;
  } | null;
  subject: { id: string; name: string; short: string } | null;
  teachers: { id: string; name: string; short: string }[];
};

type Teacher = {
  firstName: string;
  gender: string | null;
  id: string;
  lastName: string;
  short: string;
  userId: string | null;
};

type SubstitutionItem = {
  lessons: EnrichedLesson[];
  substitution: {
    date: string;
    id: string;
    substituter: string | null;
  };
  teacher: Teacher | null;
};

type SubstitutionsTableProps = {
  data: SubstitutionItem[];
  isLoading: boolean;
  hasWritePermission: boolean;
  onEdit: (sub: SubstitutionItem) => void;
  onDelete: (sub: SubstitutionItem) => void;
  isPendingDelete: boolean;
};

export function SubstitutionsTable({
  data,
  isLoading,
  hasWritePermission,
  onEdit,
  onDelete,
  isPendingDelete,
}: SubstitutionsTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('substitution.date')}</TableHead>
            <TableHead>{t('substitution.substituteTeacher')}</TableHead>
            <TableHead>{t('substitution.affectedLessons')}</TableHead>
            <TableHead>{t('substitution.cohorts')}</TableHead>
            {hasWritePermission && (
              <TableHead>{t('substitution.actions')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((sub) => (
            <TableRow key={sub.substitution.id}>
              <TableCell className="font-medium">
                {dayjs(sub.substitution.date).format('YYYY/MM/DD')}
              </TableCell>
              <TableCell>
                {sub.teacher ? (
                  `${sub.teacher.firstName} ${sub.teacher.lastName}`
                ) : (
                  <Badge variant="destructive">
                    {t('substitution.cancelled')}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {sub.lessons.length > 0
                  ? sub.lessons
                      .map(
                        (l) =>
                          `${l.subject?.short ?? '?'} P${l.period?.period ?? '?'}`
                      )
                      .join(', ')
                  : t('substitution.noLessons')}
              </TableCell>
              <TableCell>
                {Array.from(
                  new Set(sub.lessons.flatMap((l) => l.cohorts))
                ).join(', ') || '-'}
              </TableCell>
              {hasWritePermission && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onEdit(sub)}
                      size="icon"
                      variant="outline"
                    >
                      <Pen className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={isPendingDelete}
                      onClick={() => onDelete(sub)}
                      size="icon"
                      variant="destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!data.length && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={hasWritePermission ? 5 : 4}
              >
                {t('substitution.noSubstitutions')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
