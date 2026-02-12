import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RoleDialog } from '@/components/admin/role-dialog';
import { RolesTable } from '@/components/admin/roles-table';
import { Button } from '@/components/ui/button';
import { api } from '@/utils/hc';

export const Route = createFileRoute('/_private/admin/roles')({
  component: AdminRolesPage,
});

function AdminRolesPage() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const rolesQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.roles.index.$get());
      if (!res.success) {
        throw new Error('Failed to load roles');
      }
      return res.data;
    },
    queryKey: ['roles'],
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t('roles.title')}</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          {t('roles.createRole')}
        </Button>
      </div>
      {(() => {
        if (rolesQuery.isLoading) {
          return <p>{t('common.loading')}</p>;
        }
        if (rolesQuery.isError) {
          return <p className="text-red-500">{t('roles.loadError')}</p>;
        }
        if (!rolesQuery.data) {
          return <p>{t('roles.noRoles')}</p>;
        }
        return <RolesTable roles={rolesQuery.data.roles} />;
      })()}
      <RoleDialog
        editingRole={null}
        onOpenChange={setIsCreateDialogOpen}
        open={isCreateDialogOpen}
      />
    </div>
  );
}
