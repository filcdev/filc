import type { InferResponseType } from 'hono';
import { useState } from 'react';
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
import { UserDialog } from './user-dialog';

type User = InferResponseType<
  typeof api.users.index.$get
>['data']['users'][number];

type UsersTableProps = {
  users: User[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
};

export function UsersTable({
  users,
  total,
  page,
  limit,
  onPageChange,
}: UsersTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Page {page} of {totalPages}
        </div>
        <div className="space-x-2">
          <Button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            variant="outline"
          >
            Next
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
