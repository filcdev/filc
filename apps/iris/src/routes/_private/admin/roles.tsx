import { createFileRoute } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
import { RefreshCw, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RoleDialog } from '@/components/admin/role-dialog';
import { RolesTable } from '@/components/admin/roles-table';
import { StatCard } from '@/components/admin/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryBoundary } from '@/components/util/query-boundary';
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

export const Route = createFileRoute('/_private/admin/roles')({
  component: AdminRolesPage,
});

function AdminRolesPage() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const rolesQuery = useApiQuery<
    NonNullable<InferResponseType<typeof api.roles.index.$get>['data']>
  >(() => api.roles.index.$get(), {
    queryKey: queryKeys.roles(),
  });

  const allRoles = rolesQuery.data?.roles ?? [];

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return allRoles;
    }
    return allRoles.filter((role) => role.name.toLowerCase().includes(term));
  }, [allRoles, search]);

  const stats = useMemo(
    () => ({
      emptyRoles: allRoles.filter((r) => r.can.length === 0).length,
      totalPermissions: allRoles.reduce((sum, r) => sum + r.can.length, 0),
      totalRoles: allRoles.length,
    }),
    [allRoles]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('roles.title')}
        </h1>
        <p className="text-muted-foreground">{t('roles.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('roles.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => rolesQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('roles.refresh')}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            {t('roles.createRole')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Shield className="text-primary" />}
          label={t('roles.totalRoles')}
          value={stats.totalRoles}
        />
        <StatCard
          icon={<ShieldCheck className="text-primary" />}
          label={t('roles.totalPermissions')}
          value={stats.totalPermissions}
        />
        <StatCard
          icon={<ShieldOff className="text-primary" />}
          label={t('roles.emptyRoles')}
          value={stats.emptyRoles}
        />
      </div>

      <QueryBoundary data={rolesQuery.data} query={rolesQuery}>
        {() => <RolesTable roles={filteredRoles} />}
      </QueryBoundary>

      <RoleDialog
        editingRole={null}
        onOpenChange={setIsCreateDialogOpen}
        open={isCreateDialogOpen}
      />
    </div>
  );
}
