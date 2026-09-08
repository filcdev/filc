import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StairDialog } from '@/components/admin/navigator/stair-dialog';
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
  type NavigatorStair,
  useBuildings,
  useDeleteStair,
  useStairs,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute('/_private/admin/navigator/stairs')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <StairsPage />
    </PermissionGuard>
  ),
});

type StairSortColumn =
  | 'name'
  | 'building'
  | 'x'
  | 'y'
  | 'minStorey'
  | 'rotation';

type StairRow = NavigatorStair & { buildingName: string };

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

function StairsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<StairSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStair, setSelectedStair] = useState<NavigatorStair | null>(
    null
  );

  const stairsQuery = useStairs();
  const buildingsQuery = useBuildings();
  const deleteMutation = useDeleteStair();

  const stairs: NavigatorStair[] | undefined = stairsQuery.data?.stairs;

  const buildingNameById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data?.buildings ?? []).map((b) => [b.id, b.name])
      ),
    [buildingsQuery.data]
  );

  const rows: StairRow[] = useMemo(
    () =>
      (stairs ?? []).map((stair) => ({
        ...stair,
        buildingName: buildingNameById.get(stair.buildingId) ?? '—',
      })),
    [stairs, buildingNameById]
  );

  const filteredStairs = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = rows;

    if (term) {
      filtered = filtered.filter(
        (stair) =>
          stair.name.toLowerCase().includes(term) ||
          stair.buildingName.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getStairSortValue(a, sortColumn);
        const bValue = getStairSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [rows, search, sortColumn, sortDirection]);

  const handleDelete = async (stair: NavigatorStair) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.stairs.deleteConfirm', { name: stair.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(stair.id);
  };

  const handleSort = (column: StairSortColumn) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.stairs.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.stairs.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.stairs.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => stairsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.stairs.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedStair(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.stairs.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={stairsQuery.data} query={stairsQuery}>
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
                      {t('navigator.stairs.name')}
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
                      {t('navigator.stairs.building')}
                      <SortIcon
                        column="building"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState('x', sortColumn, sortDirection)}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('x')}
                      type="button"
                    >
                      {t('navigator.stairs.x')}
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
                      {t('navigator.stairs.y')}
                      <SortIcon
                        column="y"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'minStorey',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('minStorey')}
                      type="button"
                    >
                      {t('navigator.stairs.storeyRange')}
                      <SortIcon
                        column="minStorey"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'rotation',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('rotation')}
                      type="button"
                    >
                      {t('navigator.stairs.rotation')}
                      <SortIcon
                        column="rotation"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.stairs.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStairs.map((stair) => (
                  <TableRow key={stair.id}>
                    <TableCell className="font-medium">{stair.name}</TableCell>
                    <TableCell>{stair.buildingName}</TableCell>
                    <TableCell>{stair.x}</TableCell>
                    <TableCell>{stair.y}</TableCell>
                    <TableCell>
                      {stair.minStorey}–{stair.maxStorey}
                    </TableCell>
                    <TableCell>{stair.rotation}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={t('navigator.common.edit', {
                            name: stair.name,
                          })}
                          onClick={() => {
                            setSelectedStair(stair);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={t('navigator.common.delete', {
                            name: stair.name,
                          })}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(stair)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredStairs.length && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={7}>
                      {t('navigator.stairs.noStairsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <StairDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedStair(null);
          }
        }}
        open={dialogOpen}
        record={selectedStair}
      />
    </div>
  );
}

function getStairSortValue(
  stair: StairRow,
  column: StairSortColumn
): string | number {
  switch (column) {
    case 'name':
      return stair.name;
    case 'building':
      return stair.buildingName;
    case 'x':
      return stair.x;
    case 'y':
      return stair.y;
    case 'minStorey':
      return stair.minStorey;
    case 'rotation':
      return stair.rotation;
    default:
      return '';
  }
}
