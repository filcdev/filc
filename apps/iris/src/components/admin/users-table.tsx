import type { InferResponseType } from 'hono';
import { useMemo, useState } from 'react';
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
import { SortIcon } from '@/components/util/sort-icon';
import type { api } from '@/utils/hc';
import type { PaginationProps } from './admin.types';
import { UserDialog } from './user-dialog';

type User = NonNullable<
  InferResponseType<typeof api.users.index.$get>['data']
>['users'][number];

type SortColumn = 'name' | 'email' | 'cohort' | 'roles';

type UsersTableProps = PaginationProps & {
  cohortMap: Map<string, string>;
  users: User[];
};

function getAriaSortState(
  column: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc' | null
): 'ascending' | 'descending' | 'none' {
  if (sortColumn !== column) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

export function UsersTable({
  cohortMap,
  users,
  total,
  page,
  limit,
  onPageChange,
}: UsersTableProps) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

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

  const sortedUsers = useMemo(() => {
    if (!(sortColumn && sortDirection)) {
      return users;
    }
    return [...users].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn, cohortMap) ?? '';
      const bVal = getSortValue(b, sortColumn, cohortMap) ?? '';
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [users, sortColumn, sortDirection, cohortMap]);

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full min-w-[768px]">
          <TableHeader>
            <TableRow>
              <TableHead
                aria-sort={getAriaSortState('name', sortColumn, sortDirection)}
                className="select-none"
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                  onClick={() => handleSort('name')}
                  type="button"
                >
                  {t('users.name')}
                  <SortIcon
                    column="name"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </button>
              </TableHead>
              <TableHead
                aria-sort={getAriaSortState('email', sortColumn, sortDirection)}
                className="select-none"
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                  onClick={() => handleSort('email')}
                  type="button"
                >
                  {t('users.email')}
                  <SortIcon
                    column="email"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </button>
              </TableHead>
              <TableHead
                aria-sort={getAriaSortState(
                  'cohort',
                  sortColumn,
                  sortDirection
                )}
                className="select-none"
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                  onClick={() => handleSort('cohort')}
                  type="button"
                >
                  {t('preferences.cohort')}
                  <SortIcon
                    column="cohort"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </button>
              </TableHead>
              <TableHead
                aria-sort={getAriaSortState('roles', sortColumn, sortDirection)}
                className="select-none"
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                  onClick={() => handleSort('roles')}
                  type="button"
                >
                  {t('users.roles')}
                  <SortIcon
                    column="roles"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </button>
              </TableHead>
              <TableHead>{t('users.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 && (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  {t('users.noUsersFound')}
                </TableCell>
              </TableRow>
            )}
            {sortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.cohortId
                    ? (cohortMap.get(user.cohortId) ?? user.cohortId)
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-row flex-wrap gap-2">
                    {user.roles.length > 0
                      ? user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))
                      : t('users.noRoles')}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => {
                      setSelectedUser(user);
                      setIsDialogOpen(true);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {t('roles.edit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          {t('users.currentPage')} {page} / {totalPages}
        </div>
        <div className="space-x-2">
          <Button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="sm"
            variant="outline"
          >
            {t('common.previous')}
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            variant="outline"
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
      {selectedUser && (
        <UserDialog
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedUser(null);
            }
          }}
          open={isDialogOpen}
          user={selectedUser}
        />
      )}
    </div>
  );
}

function getSortValue(
  user: User,
  column: SortColumn,
  cohortMap: Map<string, string>
): string {
  switch (column) {
    case 'name':
      return user.name ?? '';
    case 'email':
      return user.email ?? '';
    case 'cohort':
      return user.cohortId
        ? (cohortMap.get(user.cohortId) ?? user.cohortId)
        : '';
    case 'roles':
      return user.roles.join(' ');
    default:
      return '';
  }
}
