import { permissions } from '@filcdev/api/permissions';
import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowUpDown,
  Building2,
  DoorOpen,
  Layers,
  Palette,
  Route as RouteIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavigatorPreview } from '@/components/admin/navigator/navigator-preview';
import { StatCard } from '@/components/admin/stat-card';
import { PermissionGuard } from '@/components/util/permission-guard';
import {
  useBuildings,
  useClassrooms,
  useClassroomTypes,
  useCorridors,
  useLifts,
  useStairs,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <NavigatorOverviewPage />
    </PermissionGuard>
  ),
});

function NavigatorOverviewPage() {
  const { t } = useTranslation();

  const buildings = useBuildings();
  const classroomTypes = useClassroomTypes();
  const classrooms = useClassrooms();
  const corridors = useCorridors();
  const lifts = useLifts();
  const stairs = useStairs();

  const cards = [
    {
      icon: <Building2 className="text-primary" />,
      isLoading: buildings.isLoading,
      label: t('navigator.buildings.title'),
      value: (buildings.data ?? []).length,
    },
    {
      icon: <Palette className="text-primary" />,
      isLoading: classroomTypes.isLoading,
      label: t('navigator.classroomTypes.title'),
      value: (classroomTypes.data ?? []).length,
    },
    {
      icon: <DoorOpen className="text-primary" />,
      isLoading: classrooms.isLoading,
      label: t('navigator.classrooms.title'),
      value: (classrooms.data ?? []).length,
    },
    {
      icon: <RouteIcon className="text-primary" />,
      isLoading: corridors.isLoading,
      label: t('navigator.corridors.title'),
      value: (corridors.data ?? []).length,
    },
    {
      icon: <ArrowUpDown className="text-primary" />,
      isLoading: lifts.isLoading,
      label: t('navigator.lifts.title'),
      value: (lifts.data ?? []).length,
    },
    {
      icon: <Layers className="text-primary" />,
      isLoading: stairs.isLoading,
      label: t('navigator.stairs.title'),
      value: (stairs.data ?? []).length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.overview.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.overview.description')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard
            icon={card.icon}
            isLoading={card.isLoading}
            key={card.label}
            label={card.label}
            value={card.value}
          />
        ))}
      </div>

      <NavigatorPreview />
    </div>
  );
}
