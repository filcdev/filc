import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeacherDialog } from '@/components/admin/teacher-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type AdminTeacher,
  useTeachersAdmin,
} from '@/hooks/timetable-teachers';

export const Route = createFileRoute('/_private/admin/timetable/teachers')({
  component: () => (
    <PermissionGuard permission={permissions.teacherManage}>
      <TeachersPage />
    </PermissionGuard>
  ),
});

type SortColumn = 'name' | 'short' | 'email' | 'user';

function getAriaSortState(
  column: SortColumn,
  sortColumn: SortColumn | null,
  sortDirection: 'asc' | 'desc' | null
): 'ascending' | 'descending' | 'none' {
  if (sortColumn !== column) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

function getSortValue(teacher: AdminTeacher, column: SortColumn): string {
  switch (column) {
    case 'name':
      return `${teacher.firstName} ${teacher.lastName}`.trim();
    case 'short':
      return teacher.short;
    case 'email':
      return teacher.email ?? '';
    case 'user':
      return teacher.user ? `${teacher.user.name} ${teacher.user.email}` : '';
    default:
      return '';
  }
}

function TeachersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<AdminTeacher | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );

  const teachersQuery = useTeachersAdmin();

  const filtered = useMemo(() => {
    let list = teachersQuery.data ?? [];
    const term = search.trim().toLowerCase();

    if (term) {
      list = list.filter(
        (teacher) =>
          `${teacher.firstName} ${teacher.lastName}`
            .toLowerCase()
            .includes(term) ||
          teacher.short.toLowerCase().includes(term) ||
          (teacher.email ?? '').toLowerCase().includes(term) ||
          (teacher.user
            ? `${teacher.user.name} ${teacher.user.email}`
                .toLowerCase()
                .includes(term)
            : false)
      );
    }

    if (sortColumn && sortDirection) {
      list = [...list].sort((a, b) => {
        const aVal = getSortValue(a, sortColumn);
        const bVal = getSortValue(b, sortColumn);
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return list;
  }, [teachersQuery.data, search, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('teachers.title')}
        </h1>
        <p className="text-muted-foreground">{t('teachers.description')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="w-full sm:max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('teachers.searchPlaceholder')}
          value={search}
        />
      </div>

      <QueryBoundary data={teachersQuery.data} query={teachersQuery}>
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-3xl">
              <TableHeader>
                <TableRow>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'name',
                      sortColumn,
                      sortDirection
                    )}
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      {t('teachers.name')}
                      <SortIcon
                        column="name"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'short',
                      sortColumn,
                      sortDirection
                    )}
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('short')}
                  >
                    <div className="flex items-center gap-2">
                      {t('teachers.short')}
                      <SortIcon
                        column="short"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'email',
                      sortColumn,
                      sortDirection
                    )}
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      {t('teachers.email')}
                      <SortIcon
                        column="email"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'user',
                      sortColumn,
                      sortDirection
                    )}
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('user')}
                  >
                    <div className="flex items-center gap-2">
                      {t('teachers.assignedUser')}
                      <SortIcon
                        column="user"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead>{t('users.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      {t('teachers.noTeachersFound')}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      {`${teacher.firstName} ${teacher.lastName}`.trim()}
                    </TableCell>
                    <TableCell>{teacher.short}</TableCell>
                    <TableCell
                      className="max-w-56 truncate"
                      title={teacher.email ?? ''}
                    >
                      {teacher.email ?? '-'}
                    </TableCell>
                    <TableCell
                      className="max-w-64 truncate"
                      title={
                        teacher.user
                          ? `${teacher.user.name} (${teacher.user.email})`
                          : t('teachers.unassigned')
                      }
                    >
                      {teacher.user
                        ? `${teacher.user.name} (${teacher.user.email})`
                        : t('teachers.unassigned')}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setIsDialogOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Pen className="size-4" />
                        {t('teachers.edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>
      {selectedTeacher && (
        <TeacherDialog
          key={selectedTeacher.id}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedTeacher(null);
            }
          }}
          open={isDialogOpen}
          teacher={selectedTeacher}
        />
      )}
    </div>
  );
}
