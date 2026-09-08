import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CorridorDialog } from '@/components/admin/navigator/corridor-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  type NavigatorCorridor,
  useBuildings,
  useCorridors,
  useDeleteCorridor,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute('/_private/admin/navigator/corridors')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <CorridorsPage />
    </PermissionGuard>
  ),
});

type CorridorSortColumn = 'name' | 'building' | 'storey' | 'width';

type CorridorRow = NavigatorCorridor & { buildingName: string };

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

function CorridorsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<CorridorSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCorridor, setSelectedCorridor] =
    useState<NavigatorCorridor | null>(null);

  const corridorsQuery = useCorridors();
  const buildingsQuery = useBuildings();
  const deleteMutation = useDeleteCorridor();

  const corridors: NavigatorCorridor[] | undefined =
    corridorsQuery.data?.corridors;

  const buildingNameById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data?.buildings ?? []).map((b) => [b.id, b.name])
      ),
    [buildingsQuery.data]
  );

  const rows: CorridorRow[] = useMemo(
    () =>
      (corridors ?? []).map((corridor) => ({
        ...corridor,
        buildingName: buildingNameById.get(corridor.buildingId) ?? '—',
      })),
    [corridors, buildingNameById]
  );

  const filteredCorridors = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = rows;

    if (term) {
      filtered = filtered.filter(
        (corridor) =>
          corridor.name.toLowerCase().includes(term) ||
          corridor.buildingName.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getCorridorSortValue(a, sortColumn);
        const bValue = getCorridorSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [rows, search, sortColumn, sortDirection]);

  const handleDelete = async (corridor: NavigatorCorridor) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.corridors.deleteConfirm', { name: corridor.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(corridor.id);
  };

  const handleSort = (column: CorridorSortColumn) => {
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

  const renderBuildingName = (name: string) => {
    if (buildingsQuery.isLoading) {
      return <Skeleton className="h-4 w-24" />;
    }
    if (buildingsQuery.isError) {
      return (
        <span className="text-destructive">
          {t('navigator.corridors.loadError')}
        </span>
      );
    }
    return name;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.corridors.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.corridors.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.corridors.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => corridorsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.corridors.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedCorridor(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.corridors.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={corridorsQuery.data} query={corridorsQuery}>
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
                      {t('navigator.corridors.name')}
                      <SortIcon
                        column="name"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'building',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('building')}
                      type="button"
                    >
                      {t('navigator.corridors.building')}
                      <SortIcon
                        column="building"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'storey',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('storey')}
                      type="button"
                    >
                      {t('navigator.corridors.storey')}
                      <SortIcon
                        column="storey"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.corridors.coords')}</TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'width',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('width')}
                      type="button"
                    >
                      {t('navigator.corridors.width')}
                      <SortIcon
                        column="width"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.corridors.flags')}</TableHead>
                  <TableHead>{t('navigator.corridors.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCorridors.map((corridor) => (
                  <TableRow key={corridor.id}>
                    <TableCell className="font-medium">
                      {corridor.name}
                    </TableCell>
                    <TableCell>
                      {renderBuildingName(corridor.buildingName)}
                    </TableCell>
                    <TableCell>{corridor.storey}</TableCell>
                    <TableCell>
                      ({corridor.x1}, {corridor.y1}) → ({corridor.x2},{' '}
                      {corridor.y2})
                    </TableCell>
                    <TableCell>{corridor.width}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {corridor.barrierFree && (
                          <Badge variant="secondary">
                            {t('navigator.corridors.barrierFree')}
                          </Badge>
                        )}
                        {corridor.isOutdoor && (
                          <Badge variant="outline">
                            {t('navigator.corridors.isOutdoor')}
                          </Badge>
                        )}
                        {!(corridor.barrierFree || corridor.isOutdoor) && '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedCorridor(corridor);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(corridor)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredCorridors.length && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={7}>
                      {t('navigator.corridors.noCorridorsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <CorridorDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedCorridor(null);
          }
        }}
        open={dialogOpen}
        record={selectedCorridor}
      />
    </div>
  );
}

function getCorridorSortValue(
  corridor: CorridorRow,
  column: CorridorSortColumn
): string | number {
  switch (column) {
    case 'name':
      return corridor.name;
    case 'building':
      return corridor.buildingName;
    case 'storey':
      return corridor.storey;
    case 'width':
      return corridor.width;
    default:
      return '';
  }
}
