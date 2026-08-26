import { useState } from 'react';
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
import { type Role, useDeleteRole } from '@/hooks/admin-users';
import { RoleDialog } from './role-dialog';

type RolesTableProps = {
  roles: Role[];
};

export function RolesTable({ roles }: RolesTableProps) {
  const { t } = useTranslation();
  const deleteRole = useDeleteRole();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full min-w-3xl">
          <TableHeader>
            <TableRow>
              <TableHead>{t('roles.name')}</TableHead>
              <TableHead>{t('roles.permissions')}</TableHead>
              <TableHead>{t('roles.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 && (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={3}>
                  {t('roles.noRoles')}
                </TableCell>
              </TableRow>
            )}
            {roles.map((role) => (
              <TableRow key={role.name}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {role.can.length === 0 ? (
                      <span className="text-muted-foreground text-sm">
                        {t('roles.noPermissions')}
                      </span>
                    ) : (
                      role.can.map((perm) => (
                        <Badge key={perm} variant="secondary">
                          {perm}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setSelectedRole(role);
                        setIsDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {t('roles.edit')}
                    </Button>
                    <Button
                      disabled={deleteRole.isPending}
                      onClick={() => deleteRole.mutate(role.name)}
                      size="sm"
                      variant="destructive"
                    >
                      {t('roles.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isDialogOpen && (
        <RoleDialog
          editingRole={selectedRole}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedRole(null);
            }
          }}
          open={isDialogOpen}
        />
      )}
    </div>
  );
}
