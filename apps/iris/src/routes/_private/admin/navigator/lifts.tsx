import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiftDialog } from '@/components/admin/navigator/lift-dialog';
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
  type NavigatorLift,
  useBuildings,
  useDeleteLift,
  useLifts,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute('/_private/admin/navigator/lifts')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <LiftsPage />
    </PermissionGuard>
  ),
});

type LiftSortColumn = 'name' | 'building' | 'x' | 'y' | 'minStorey';

type LiftRow = NavigatorLift & { buildingName: string };

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

function LiftsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<LiftSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLift, setSelectedLift] = useState<NavigatorLift | null>(null);

  const liftsQuery = useLifts();
  const buildingsQuery = useBuildings();
  const deleteMutation = useDeleteLift();

  const lifts: NavigatorLift[] | undefined = liftsQuery.data?.lifts;

  const buildingNameById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data?.buildings ?? []).map((b) => [b.id, b.name])
      ),
    [buildingsQuery.data]
  );

  const rows: LiftRow[] = useMemo(
    () =>
      (lifts ?? []).map((lift) => ({
        ...lift,
        buildingName: buildingNameById.get(lift.buildingId) ?? '—',
      })),
    [lifts, buildingNameById]
  );

  const filteredLifts = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = rows;

    if (term) {
      filtered = filtered.filter(
        (lift) =>
          lift.name.toLowerCase().includes(term) ||
          lift.buildingName.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getLiftSortValue(a, sortColumn);
        const bValue = getLiftSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [rows, search, sortColumn, sortDirection]);

  const handleDelete = async (lift: NavigatorLift) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.lifts.deleteConfirm', { name: lift.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(lift.id);
  };

  const handleSort = (column: LiftSortColumn) => {
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
          {t('navigator.lifts.title')}
        </h1>
        <p className="text-muted-foreground">{t('navigator.lifts.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.lifts.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => liftsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.lifts.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedLift(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.lifts.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={liftsQuery.data} query={liftsQuery}>
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-2xl">
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
                      {t('navigator.lifts.name')}
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
                      {t('navigator.lifts.building')}
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
                      {t('navigator.lifts.x')}
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
                      {t('navigator.lifts.y')}
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
                      {t('navigator.lifts.storeyRange')}
                      <SortIcon
                        column="minStorey"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.lifts.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLifts.map((lift) => (
                  <TableRow key={lift.id}>
                    <TableCell className="font-medium">{lift.name}</TableCell>
                    <TableCell>{lift.buildingName}</TableCell>
                    <TableCell>{lift.x}</TableCell>
                    <TableCell>{lift.y}</TableCell>
                    <TableCell>
                      {lift.minStorey}–{lift.maxStorey}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={t('navigator.common.edit', {
                            name: lift.name,
                          })}
                          onClick={() => {
                            setSelectedLift(lift);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={t('navigator.common.delete', {
                            name: lift.name,
                          })}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(lift)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredLifts.length && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>
                      {t('navigator.lifts.noLiftsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <LiftDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedLift(null);
          }
        }}
        open={dialogOpen}
        record={selectedLift}
      />
    </div>
  );
}

function getLiftSortValue(
  lift: LiftRow,
  column: LiftSortColumn
): string | number {
  switch (column) {
    case 'name':
      return lift.name;
    case 'building':
      return lift.buildingName;
    case 'x':
      return lift.x;
    case 'y':
      return lift.y;
    case 'minStorey':
      return lift.minStorey;
    default:
      return '';
  }
}
