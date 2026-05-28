import type { InferResponseType } from 'hono';
import { useState } from 'react';
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
import type { api } from '@/utils/hc';
import type { PaginationProps } from './admin.types';
import { UserDialog } from './user-dialog';

type User = NonNullable<
  InferResponseType<typeof api.users.index.$get>['data']
>['users'][number];

type UsersTableProps = PaginationProps & {
  users: User[];
};

export function UsersTable({
  users,
  total,
  page,
  limit,
  onPageChange,
}: UsersTableProps) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.name')}</TableHead>
              <TableHead>{t('users.email')}</TableHead>
              <TableHead>{t('users.roles')}</TableHead>
              <TableHead>{t('users.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  {t('users.noUsersFound')}
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roles.join(', ')}</TableCell>
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
