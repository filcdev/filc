import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CalendarClock, CircleCheck, KeyRound, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AdminApiKeysTable } from '@/components/admin/api-keys-table';
import { StatCard } from '@/components/admin/stat-card';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  ADMIN_API_KEYS_PAGE_SIZE,
  adminApiKeysQueryOptions,
  useAdminApiKeys,
} from '@/hooks/admin-api-keys';
import { prefetch } from '@/utils/orpc';

/** Keys expiring within this window count as "expiring soon". */
const EXPIRING_SOON_DAYS = 30;

const searchSchema = z.object({
  ownerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().default(''),
});

export const Route = createFileRoute('/_private/admin/api-keys')({
  component: AdminApiKeysPage,
  // Params come off the location rather than `loaderDeps`, matching the admin
  // users page: a `loaderDeps` above `validateSearch` would fix the search type.
  loader: ({ context, location }) => {
    const params = new URLSearchParams(location.searchStr);
    const page = Number(params.get('page')) || 1;
    const ownerId = params.get('ownerId') ?? undefined;
    return prefetch(
      context.queryClient,
      adminApiKeysQueryOptions({
        limit: ADMIN_API_KEYS_PAGE_SIZE,
        offset: (page - 1) * ADMIN_API_KEYS_PAGE_SIZE,
        ownerId,
        search: params.get('search') ?? '',
      })
    );
  },
  validateSearch: searchSchema,
});

function AdminApiKeysPage() {
  return (
    <PermissionGuard permission={permissions.usersManage}>
      <AdminApiKeysContent />
    </PermissionGuard>
  );
}

function AdminApiKeysContent() {
  const { t } = useTranslation();
  const { page, ownerId, search } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputValue, setInputValue] = useState(search);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    if (inputValue === search) {
      return;
    }
    const timer = setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, page: 1, search: inputValue }),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, search, navigate]);

  const apiKeysQuery = useAdminApiKeys({
    limit: ADMIN_API_KEYS_PAGE_SIZE,
    offset: (page - 1) * ADMIN_API_KEYS_PAGE_SIZE,
    ownerId,
    search,
  });

  const total = apiKeysQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_API_KEYS_PAGE_SIZE));

  // The cards describe the loaded page; `total` is the only whole-set count the
  // endpoint returns.
  const stats = useMemo(() => {
    const rows = apiKeysQuery.data?.apiKeys ?? [];
    const soonThreshold = Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
    return {
      enabled: rows.filter((apiKey) => apiKey.enabled).length,
      expiringSoon: rows.filter((apiKey) => {
        if (apiKey.expiresAt === null || apiKey.expiresAt === undefined) {
          return false;
        }
        const expiresAt = new Date(apiKey.expiresAt).getTime();
        return (
          !Number.isNaN(expiresAt) &&
          expiresAt > Date.now() &&
          expiresAt <= soonThreshold
        );
      }).length,
    };
  }, [apiKeysQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('adminApiKeys.title')}
        </h1>
        <p className="text-muted-foreground">{t('adminApiKeys.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('adminApiKeys.searchPlaceholder')}
          type="text"
          value={inputValue}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => apiKeysQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('adminApiKeys.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<KeyRound className="text-primary" />}
          label={t('adminApiKeys.totalKeys')}
          value={total}
        />
        <StatCard
          icon={<CircleCheck className="text-primary" />}
          label={t('adminApiKeys.enabledOnPage')}
          value={stats.enabled}
        />
        <StatCard
          icon={<CalendarClock className="text-primary" />}
          label={t('adminApiKeys.expiringSoonOnPage')}
          value={stats.expiringSoon}
        />
      </div>

      <QueryBoundary data={apiKeysQuery.data} query={apiKeysQuery}>
        {(data) => (
          <div className="space-y-4">
            <AdminApiKeysTable apiKeys={data.apiKeys} ownerId={ownerId} />
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                {t('adminApiKeys.currentPage')} {page} / {totalPages}
              </div>
              <div className="space-x-2">
                <Button
                  disabled={page <= 1}
                  onClick={() =>
                    navigate({
                      search: (prev) => ({ ...prev, page: page - 1 }),
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  {t('common.previous')}
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() =>
                    navigate({
                      search: (prev) => ({ ...prev, page: page + 1 }),
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
