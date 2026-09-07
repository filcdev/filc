import { permissions } from '@filcdev/api/permissions';

import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Building2,
  Languages,
  MoveVertical,
  Palette,
  School,
  TrendingUp,
  Waypoints,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/admin/stat-card';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    labelKey: 'navigator.overview.manageCorridors',
    to: '/admin/navigator/corridors',
  },
  {
    Icon: MoveVertical,
    labelKey: 'navigator.overview.manageLifts',
    to: '/admin/navigator/lifts',
  },
  {
    Icon: TrendingUp,
    labelKey: 'navigator.overview.manageStairs',
    to: '/admin/navigator/stairs',
  },
  {
    Icon: Languages,
    labelKey: 'navigator.overview.manageTranslations',
    to: '/admin/navigator/translations',
  },
] as const;

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
                  label={t('navigator.overview.corridors')}
                  value={graph.corridors.length}
                />
                <StatCard
                  icon={<MoveVertical className="text-primary" />}
                  label={t('navigator.overview.lifts')}
                  value={graph.lifts.length}
                />
                <StatCard
                  icon={<TrendingUp className="text-primary" />}
                  label={t('navigator.overview.stairs')}
                  value={graph.stairs.length}
                />
              </div>

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
