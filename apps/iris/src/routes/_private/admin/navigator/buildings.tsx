import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingDialog } from '@/components/admin/navigator/building-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type NavigatorBuilding,
  useBuildings,
  useClassrooms,
  useDeleteBuilding,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute('/_private/admin/navigator/buildings')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <BuildingsPage />
    </PermissionGuard>
  ),
});

type BuildingSortColumn = 'name' | 'x' | 'y' | 'rooms' | 'updated';

function getAriaSortState(
  column: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc' | null
): 'ascending' | 'descending' | 'none' {
  if (sortColumn !== column) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

function BuildingsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<BuildingSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] =
    useState<NavigatorBuilding | null>(null);

  const buildingsQuery = useBuildings();
  const classroomsQuery = useClassrooms();
  const deleteMutation = useDeleteBuilding();

  const buildings: NavigatorBuilding[] | undefined =
    buildingsQuery.data?.buildings;

  const roomCountByBuilding = useMemo(() => {
    const counts = new Map<string, number>();
    for (const classroom of classroomsQuery.data?.classrooms ?? []) {
      counts.set(
        classroom.buildingId,
        (counts.get(classroom.buildingId) ?? 0) + 1
      );
    }
    return counts;
  }, [classroomsQuery.data]);

  const filteredBuildings = useMemo(() => {
    const items = buildings ?? [];
    const term = search.trim().toLowerCase();
    let filtered = items;

    if (term) {
      filtered = filtered.filter(
        (building) =>
          building.name.toLowerCase().includes(term) ||
          (building.description ?? '').toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getBuildingSortValue(a, sortColumn, roomCountByBuilding);
        const bValue = getBuildingSortValue(b, sortColumn, roomCountByBuilding);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [buildings, search, sortColumn, sortDirection, roomCountByBuilding]);

  const handleDelete = async (building: NavigatorBuilding) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.buildings.deleteConfirm', { name: building.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(building.id);
  };

  const handleSort = (column: BuildingSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  const hasError = buildingsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.buildings.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.buildings.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.buildings.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => buildingsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.buildings.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedBuilding(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.buildings.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={buildingsQuery.data} query={buildingsQuery}>
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-3xl">
              <TableHeader>
                <TableRow>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'name',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('name')}
                      type="button"
                    >
                      {t('navigator.buildings.name')}
                      <SortIcon
                        column="name"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.buildings.description')}</TableHead>
                  <TableHead
                    aria-sort={getAriaSortState('x', sortColumn, sortDirection)}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('x')}
                      type="button"
                    >
                      {t('navigator.buildings.x')}
                      <SortIcon
                        column="x"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState('y', sortColumn, sortDirection)}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('y')}
                      type="button"
                    >
                      {t('navigator.buildings.y')}
                      <SortIcon
                        column="y"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'rooms',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('rooms')}
                      type="button"
                    >
                      {t('navigator.buildings.rooms')}
                      <SortIcon
                        column="rooms"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'updated',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('updated')}
                      type="button"
                    >
                      {t('navigator.buildings.updatedAt')}
                      <SortIcon
                        column="updated"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.buildings.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuildings.map((building) => (
                  <TableRow key={building.id}>
                    <TableCell className="font-medium">
                      {building.name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {building.description || '—'}
                    </TableCell>
                    <TableCell>{building.x}</TableCell>
                    <TableCell>{building.y}</TableCell>
                    <TableCell>
                      {roomCountByBuilding.get(building.id) ?? 0}
                    </TableCell>
                    <TableCell>
                      {dayjs(building.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedBuilding(building);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(building)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!(filteredBuildings.length || hasError) && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={7}>
                      {t('navigator.buildings.noBuildingsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <BuildingDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedBuilding(null);
          }
        }}
        open={dialogOpen}
        record={selectedBuilding}
      />
    </div>
  );
}

function getBuildingSortValue(
  building: NavigatorBuilding,
  column: BuildingSortColumn,
  roomCountByBuilding: Map<string, number>
): string | number {
  switch (column) {
    case 'name':
      return building.name;
    case 'x':
      return building.x;
    case 'y':
      return building.y;
    case 'rooms':
      return roomCountByBuilding.get(building.id) ?? 0;
    case 'updated':
      return new Date(building.updatedAt).getTime();
    default:
      return '';
  }
}
