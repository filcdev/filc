import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClassroomTypeDialog } from '@/components/admin/navigator/classroom-type-dialog';
import { Badge } from '@/components/ui/badge';
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
  type NavigatorClassroomType,
  useClassroomTypes,
  useDeleteClassroomType,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute(
  '/_private/admin/navigator/classroom-types'
)({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <ClassroomTypesPage />
    </PermissionGuard>
  ),
});

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

function ClassroomTypesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<'name' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] =
    useState<NavigatorClassroomType | null>(null);

  const classroomTypesQuery = useClassroomTypes();
  const deleteMutation = useDeleteClassroomType();

  const classroomTypes: NavigatorClassroomType[] | undefined =
    classroomTypesQuery.data?.classroomTypes;

  const filteredTypes = useMemo(() => {
    const items = classroomTypes ?? [];
    const term = search.trim().toLowerCase();
    let filtered = items;

    if (term) {
      filtered = filtered.filter((type) =>
        type.name.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [classroomTypes, search, sortColumn, sortDirection]);

  const handleDelete = async (type: NavigatorClassroomType) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.classroomTypes.deleteConfirm', { name: type.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(type.id);
  };

  const handleSort = () => {
    if (sortColumn === 'name') {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn('name');
    setSortDirection('asc');
  };

  const hasError = classroomTypesQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.classroomTypes.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.classroomTypes.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.classroomTypes.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => classroomTypesQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            {t('navigator.classroomTypes.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedType(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.classroomTypes.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary
        data={classroomTypesQuery.data}
        query={classroomTypesQuery}
      >
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-xl">
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
                      onClick={handleSort}
                      type="button"
                    >
                      {t('navigator.classroomTypes.name')}
                      <SortIcon
                        column="name"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    {t('navigator.classroomTypes.colorhex')}
                  </TableHead>
                  <TableHead>{t('navigator.classroomTypes.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      {type.colorhex ? (
                        <Badge
                          className="border-border text-foreground"
                          style={{ backgroundColor: type.colorhex }}
                          variant="outline"
                        >
                          {type.colorhex}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedType(type);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(type)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!(filteredTypes.length || hasError) && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={3}>
                      {t('navigator.classroomTypes.noClassroomTypesFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <ClassroomTypeDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedType(null);
          }
        }}
        open={dialogOpen}
        record={selectedType}
      />
    </div>
  );
}
