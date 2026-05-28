import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { BookOpen, RefreshCw, UserCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { StatCard } from '@/components/admin/stat-card';
import { UsersTable } from '@/components/admin/users-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

const searchSchema = z.object({
  page: z.number().int().min(1).default(1),
  search: z.string().default(''),
});

export const Route = createFileRoute('/_private/admin/users')({
  component: AdminUsersPage,
  validateSearch: searchSchema,
});

function AdminUsersPage() {
  const { t } = useTranslation();
  const { page, search } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputValue, setInputValue] = useState(search);
  const limit = 20;

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

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) { throw new Error('Failed to load cohorts'); }
      return res.data ?? [];
    },
    queryKey: queryKeys.cohorts(),
  });

  const cohortMap = useMemo(
    () => new Map((cohortsQuery.data ?? []).map((c) => [c.id, c.name])),
    [cohortsQuery.data]
  );

  const usersQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(
        api.users.index.$get({
          query: {
            limit: limit.toString(),
            offset: ((page - 1) * limit).toString(),
            search,
          },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load users');
      }
      return res.data;
    },
    queryKey: queryKeys.users(page, search),
  });

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const stats = useMemo(
    () => ({ currentPage: page, total, totalPages }),
    [page, total, totalPages]
  );

  const isLoading = usersQuery.isLoading;
  const hasError = usersQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('users.title')}
        </h1>
        <p className="text-muted-foreground">{t('users.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('users.searchPlaceholder')}
          type="text"
          value={inputValue}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => usersQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('users.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Users className="text-primary" />}
          label={t('users.totalUsers')}
          value={stats.total}
        />
        <StatCard
          icon={<UserCheck className="text-primary" />}
          label={t('users.currentPage')}
          value={stats.currentPage}
        />
        <StatCard
          icon={<BookOpen className="text-primary" />}
          label={t('users.totalPages')}
          value={stats.totalPages}
        />
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('users.loadError')}</AlertTitle>
          <AlertDescription>
            {(usersQuery.error as Error)?.message ??
              t('users.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        usersQuery.data && (
          <UsersTable
            cohortMap={cohortMap}
            limit={limit}
            onPageChange={(newPage) =>
              navigate({ search: (prev) => ({ ...prev, page: newPage }) })
            }
            page={page}
            total={usersQuery.data.total}
            users={usersQuery.data.users}
          />
        )
      )}
    </div>
  );
}
