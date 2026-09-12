import { permissions } from '@filcdev/api/permissions';

import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2, Languages, Palette, School, Waypoints } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { TransferActions } from '@/components/admin/navigator/transfer-actions';
import { StatCard } from '@/components/admin/stat-card';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { useNavigatorGraph } from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <NavigatorOverview />
    </PermissionGuard>
  ),
});

const quickLinks = [
  {
    Icon: Building2,
    labelKey: 'navigator.overview.manageBuildings',
    to: '/admin/navigator/buildings',
  },
  {
    Icon: Palette,
    labelKey: 'navigator.overview.manageClassroomTypes',
    to: '/admin/navigator/classroom-types',
  },
  {
    Icon: School,
    labelKey: 'navigator.overview.manageClassrooms',
    to: '/admin/navigator/classrooms',
  },
  {
    Icon: Waypoints,
    labelKey: 'navigator.overview.manageUtilities',
    to: '/admin/navigator/utilities',
  },
  {
    Icon: Languages,
    labelKey: 'navigator.overview.manageTranslations',
    to: '/admin/navigator/translations',
  },
] as const;

const NavigatorPreview = lazy(() =>
  import('@/components/admin/navigator/preview3d/navigator-preview').then(
    (m) => ({ default: m.NavigatorPreview })
  )
);

function NavigatorOverview() {
  const { t } = useTranslation();
  const graphQuery = useNavigatorGraph();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.overview.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.overview.subtitle')}
        </p>
      </div>

      <QueryBoundary data={graphQuery.data} query={graphQuery}>
        {(graph) => {
          const roomCountByBuilding = new Map<string, number>();
          for (const classroom of graph.classrooms) {
            roomCountByBuilding.set(
              classroom.buildingId,
              (roomCountByBuilding.get(classroom.buildingId) ?? 0) + 1
            );
          }

          return (
            <>
              <TransferActions />

              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={<Building2 className="text-primary" />}
                  label={t('navigator.overview.buildings')}
                  value={graph.buildings.length}
                />
                <StatCard
                  icon={<Palette className="text-primary" />}
                  label={t('navigator.overview.classroomTypes')}
                  value={graph.classroomTypes.length}
                />
                <StatCard
                  icon={<School className="text-primary" />}
                  label={t('navigator.overview.classrooms')}
                  value={graph.classrooms.length}
                />
                <StatCard
                  icon={<Waypoints className="text-primary" />}
                  label={t('navigator.overview.utilities')}
                  value={graph.utilities.length}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t('navigator.preview.title')}</CardTitle>
                  <CardDescription>
                    {t('navigator.preview.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense
                    fallback={<Skeleton className="h-[480px] w-full" />}
                  >
                    <NavigatorPreview graph={graph} />
                  </Suspense>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>
                      {t('navigator.overview.classroomsByBuilding')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {graph.buildings.length === 0 && (
                        <li className="text-muted-foreground text-sm">
                          {t('navigator.overview.noBuildings')}
                        </li>
                      )}
                      {graph.buildings.map((building) => (
                        <li
                          className="flex items-center justify-between text-sm"
                          key={building.id}
                        >
                          <span>{building.name}</span>
                          <span className="font-semibold">
                            {roomCountByBuilding.get(building.id) ?? 0}{' '}
                            {t('navigator.overview.rooms')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('navigator.overview.manage')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      {quickLinks.map(({ Icon, labelKey, to }) => (
                        <Link
                          className={buttonVariants({
                            size: 'sm',
                            variant: 'outline',
                          })}
                          key={to}
                          to={to}
                        >
                          <Icon className="h-4 w-4" />
                          {t(labelKey)}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
