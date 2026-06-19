import { useQuery } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import {
  ArrowRightLeft,
  CalendarClock,
  GraduationCap,
  Shield,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/admin/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type SubstitutionItem = NonNullable<
  InferResponseType<typeof api.timetable.substitutions.$get>['data']
>[number];

function SubstitutionRow({
  item,
  language,
}: {
  item: SubstitutionItem;
  language: string;
}) {
  const { t } = useTranslation();
  const isCancelled = !item.substitution.substituter;
  const lessonCount = item.lessons?.length ?? 0;
  const cohortNames = [
    ...new Set((item.lessons ?? []).flatMap((l) => l?.cohorts ?? [])),
  ];
  const isPast = new Date(item.substitution.date) < new Date();

  let statusBadge: React.ReactNode;
  if (isCancelled) {
    statusBadge = (
      <Badge variant="destructive">{t('substitution.cancelled')}</Badge>
    );
  } else if (isPast) {
    statusBadge = <Badge variant="secondary">{t('dashboard.past')}</Badge>;
  } else {
    statusBadge = <Badge>{t('dashboard.upcoming')}</Badge>;
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {formatLocalizedDate(item.substitution.date, language)}
      </TableCell>
      <TableCell>
        {item.teacher
          ? `${item.teacher.firstName} ${item.teacher.lastName}`
          : '—'}
      </TableCell>
      <TableCell>{lessonCount}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {cohortNames.slice(0, 3).map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
          {cohortNames.length > 3 && (
            <Badge variant="outline">+{cohortNames.length - 3}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">{statusBadge}</TableCell>
    </TableRow>
  );
}

function SubstitutionsTable({
  substitutions,
  isLoading,
}: {
  substitutions: SubstitutionItem[];
  isLoading: boolean;
}) {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (substitutions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('dashboard.noSubstitutions')}
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('substitution.date')}</TableHead>
            <TableHead>{t('substitution.substituteTeacher')}</TableHead>
            <TableHead>{t('dashboard.affectedLessons')}</TableHead>
            <TableHead>{t('dashboard.cohorts')}</TableHead>
            <TableHead className="text-right">
              {t('dashboard.status')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {substitutions.slice(0, 20).map((item) => (
            <SubstitutionRow
              item={item}
              key={item.substitution.id}
              language={i18n.language}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();

  const usersQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(
        api.users.index.$get({
          query: { limit: '1', offset: '0' },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load users');
      }
      return res.data;
    },
    queryKey: queryKeys.usersAll(),
    staleTime: 30_000,
  });

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data ?? [];
    },
    queryKey: queryKeys.cohorts(),
    staleTime: 60_000,
  });

  const rolesQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.roles.index.$get());
      if (!res.success) {
        throw new Error('Failed to load roles');
      }
      return res.data;
    },
    queryKey: queryKeys.roles(),
    staleTime: 60_000,
  });

  const substitutionsQuery = useQuery({
    queryFn: async (): Promise<SubstitutionItem[]> => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionItem[];
    },
    queryKey: queryKeys.substitutions(),
    staleTime: 30_000,
  });

  const relevantSubstitutionsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.substitutions.relevant.$get()
      );
      if (!res.success) {
        throw new Error('Failed to load upcoming substitutions');
      }
      return res.data ?? [];
    },
    queryKey: [...queryKeys.substitutions(), 'relevant'] as const,
    staleTime: 30_000,
  });

  const totalUsers = usersQuery.data?.total ?? 0;
  const totalCohorts = cohortsQuery.data?.length ?? 0;
  const totalRoles = rolesQuery.data?.roles?.length ?? 0;
  const allSubstitutions = substitutionsQuery.data ?? [];
  const upcomingSubstitutions = relevantSubstitutionsQuery.data ?? [];

  const isLoading =
    usersQuery.isLoading ||
    cohortsQuery.isLoading ||
    rolesQuery.isLoading ||
    substitutionsQuery.isLoading ||
    relevantSubstitutionsQuery.isLoading;

  const hasError =
    usersQuery.isError ||
    cohortsQuery.isError ||
    rolesQuery.isError ||
    substitutionsQuery.isError ||
    relevantSubstitutionsQuery.isError;

  const sortedSubstitutions = useMemo(
    () =>
      [...allSubstitutions].sort((a, b) => {
        const dateA = new Date(a.substitution.date);
        const dateB = new Date(b.substitution.date);
        return dateB.getTime() - dateA.getTime();
      }),
    [allSubstitutions]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="text-muted-foreground">{t('dashboard.description')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Users className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalUsers')}
          value={totalUsers}
        />
        <StatCard
          icon={<ArrowRightLeft className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalSubstitutions')}
          value={allSubstitutions.length}
        />
        <StatCard
          icon={<CalendarClock className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.upcomingSubstitutions')}
          value={upcomingSubstitutions.length}
        />
        <StatCard
          icon={<GraduationCap className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalCohorts')}
          value={totalCohorts}
        />
        <StatCard
          icon={<Shield className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalRoles')}
          value={totalRoles}
        />
      </div>
      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('dashboard.loadError')}</AlertTitle>
          <AlertDescription>
            {t('dashboard.loadErrorDescription')}
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="font-semibold text-xl tracking-tight">
          {t('dashboard.recentSubstitutions')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('dashboard.recentSubstitutionsDescription')}
        </p>
      </div>
      <SubstitutionsTable
        isLoading={isLoading}
        substitutions={sortedSubstitutions}
      />
    </div>
  );
}
