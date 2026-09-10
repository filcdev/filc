import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UtilityDialog } from '@/components/admin/navigator/utility-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConfirmDialog } from '@/components/util/confirm-dialog';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type NavigatorUtility,
  useBuildings,
  useDeleteUtility,
  useUtilities,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/utilities')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <UtilitiesPage />
    </PermissionGuard>
  ),
});

type UtilityKind = 'corridor' | 'lift' | 'stair';
type KindFilter = 'all' | UtilityKind;

type UtilitySortColumn = 'name' | 'building' | 'kind';

type UtilityRow = NavigatorUtility & { buildingName: string };

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

function UtilitiesPage() {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [sortColumn, setSortColumn] = useState<UtilitySortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] =
    useState<NavigatorUtility | null>(null);

  const utilitiesQuery = useUtilities();
  const buildingsQuery = useBuildings();
  const deleteMutation = useDeleteUtility();

  const utilities: NavigatorUtility[] | undefined =
    utilitiesQuery.data?.utilities;

  const buildingNameById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data?.buildings ?? []).map((b) => [b.id, b.name])
      ),
    [buildingsQuery.data]
  );

  const rows: UtilityRow[] = useMemo(
    () =>
      (utilities ?? []).map((utility) => ({
        ...utility,
        buildingName: buildingNameById.get(utility.buildingId) ?? '—',
      })),
    [utilities, buildingNameById]
  );

  const filteredUtilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = rows;

    if (kindFilter !== 'all') {
      filtered = filtered.filter((utility) => utility.kind === kindFilter);
    }

    if (term) {
      filtered = filtered.filter(
        (utility) =>
          utility.name.toLowerCase().includes(term) ||
          utility.buildingName.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getUtilitySortValue(a, sortColumn);
        const bValue = getUtilitySortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [rows, search, kindFilter, sortColumn, sortDirection]);

  const handleDelete = async (utility: NavigatorUtility) => {
    const confirmed = await confirm({
      destructive: true,
      title: t('navigator.utilities.deleteConfirm', { name: utility.name }),
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(utility.id);
  };

  const handleSort = (column: UtilitySortColumn) => {
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
          {t('navigator.utilities.loadError')}
        </span>
      );
    }
    return name;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: renders a kind-specific detail summary with nullable fallbacks
  const describeUtility = (utility: NavigatorUtility): string => {
    if (utility.kind === 'corridor') {
      const flags: string[] = [];
      if (utility.barrierFree) {
        flags.push(t('navigator.utilities.barrierFree'));
      }
      if (utility.isOutdoor) {
        flags.push(t('navigator.utilities.isOutdoor'));
      }
      const flagText = flags.length > 0 ? ` · ${flags.join(', ')}` : '';
      return `L${utility.storey ?? '—'} · ${utility.width ?? '—'} · (${utility.x1 ?? '—'}, ${utility.y1 ?? '—'}) → (${utility.x2 ?? '—'}, ${utility.y2 ?? '—'})${flagText}`;
    }
    const range = `${utility.minStorey ?? '—'}–${utility.maxStorey ?? '—'}`;
    const at = `(${utility.x ?? '—'}, ${utility.y ?? '—'})`;
    return utility.kind === 'stair'
      ? `${range} · ${at} · ${utility.rotation ?? '—'}°`
      : `${range} · ${at}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.utilities.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.utilities.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.utilities.searchPlaceholder')}
          value={search}
        />
        <Select
          items={[
            { label: t('navigator.utilities.allKinds'), value: 'all' },
            ...(['corridor', 'lift', 'stair'] as const).map((kind) => ({
              label: t(`navigator.utilities.kinds.${kind}`),
              value: kind,
            })),
          ]}
          onValueChange={(value) =>
            setKindFilter((value ?? 'all') as KindFilter)
          }
          value={kindFilter}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('navigator.utilities.allKinds')} />
          </SelectTrigger>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => utilitiesQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.utilities.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedUtility(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.utilities.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={utilitiesQuery.data} query={utilitiesQuery}>
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
                      {t('navigator.utilities.name')}
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
                      {t('navigator.utilities.building')}
                      <SortIcon
                        column="building"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'kind',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('kind')}
                      type="button"
                    >
                      {t('navigator.utilities.kind')}
                      <SortIcon
                        column="kind"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.utilities.details')}</TableHead>
                  <TableHead>{t('navigator.utilities.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUtilities.map((utility) => (
                  <TableRow key={utility.id}>
                    <TableCell className="font-medium">
                      {utility.name}
                    </TableCell>
                    <TableCell>
                      {renderBuildingName(utility.buildingName)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(`navigator.utilities.kinds.${utility.kind}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{describeUtility(utility)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={t('navigator.common.edit', {
                            name: utility.name,
                          })}
                          onClick={() => {
                            setSelectedUtility(utility);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={t('navigator.common.delete', {
                            name: utility.name,
                          })}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(utility)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredUtilities.length && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      {t('navigator.utilities.noUtilitiesFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <UtilityDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedUtility(null);
          }
        }}
        open={dialogOpen}
        record={selectedUtility}
      />
      {dialog}
    </div>
  );
}

function getUtilitySortValue(
  utility: UtilityRow,
  column: UtilitySortColumn
): string | number {
  switch (column) {
    case 'name':
      return utility.name;
    case 'building':
      return utility.buildingName;
    case 'kind':
      return utility.kind;
    default:
      return '';
  }
}
