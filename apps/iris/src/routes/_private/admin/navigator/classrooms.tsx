import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClassroomDialog } from '@/components/admin/navigator/classroom-dialog';
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
  type NavigatorClassroom,
  useBuildings,
  useClassrooms,
  useClassroomTypes,
  useDeleteClassroom,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

export const Route = createFileRoute('/_private/admin/navigator/classrooms')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <ClassroomsPage />
    </PermissionGuard>
  ),
});

type ClassroomSortColumn =
  | 'name'
  | 'building'
  | 'type'
  | 'capacity'
  | 'storey'
  | 'rotation';

type ClassroomRow = NavigatorClassroom & {
  buildingName: string;
  typeColorhex: string | null;
  typeName: string;
};

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

function ClassroomsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<ClassroomSortColumn | null>(
    null
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClassroom, setSelectedClassroom] =
    useState<NavigatorClassroom | null>(null);

  const classroomsQuery = useClassrooms();
  const buildingsQuery = useBuildings();
  const classroomTypesQuery = useClassroomTypes();
  const deleteMutation = useDeleteClassroom();

  const classrooms: NavigatorClassroom[] | undefined =
    classroomsQuery.data?.classrooms;

  const buildingNameById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data?.buildings ?? []).map((b) => [b.id, b.name])
      ),
    [buildingsQuery.data]
  );

  const typeById = useMemo(
    () =>
      new Map(
        (classroomTypesQuery.data?.classroomTypes ?? []).map((ct) => [
          ct.id,
          ct,
        ])
      ),
    [classroomTypesQuery.data]
  );

  const rows: ClassroomRow[] = useMemo(
    () =>
      (classrooms ?? []).map((classroom) => {
        const type = typeById.get(classroom.typeId);
        return {
          ...classroom,
          buildingName: buildingNameById.get(classroom.buildingId) ?? '—',
          typeColorhex: type?.colorhex ?? null,
          typeName: type?.name ?? '—',
        };
      }),
    [classrooms, buildingNameById, typeById]
  );

  const filteredClassrooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = rows;

    if (term) {
      filtered = filtered.filter(
        (classroom) =>
          classroom.name.toLowerCase().includes(term) ||
          classroom.buildingName.toLowerCase().includes(term) ||
          (classroom.description ?? '').toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getClassroomSortValue(a, sortColumn);
        const bValue = getClassroomSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [rows, search, sortColumn, sortDirection]);

  const handleDelete = async (classroom: NavigatorClassroom) => {
    const confirmed = confirmDestructiveAction(
      t('navigator.classrooms.deleteConfirm', { name: classroom.name })
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(classroom.id);
  };

  const handleSort = (column: ClassroomSortColumn) => {
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

  const hasError = classroomsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.classrooms.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.classrooms.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.classrooms.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => classroomsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.classrooms.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedClassroom(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.classrooms.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={classroomsQuery.data} query={classroomsQuery}>
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-4xl">
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
                      {t('navigator.classrooms.name')}
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
                      {t('navigator.classrooms.building')}
                      <SortIcon
                        column="building"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'type',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('type')}
                      type="button"
                    >
                      {t('navigator.classrooms.type')}
                      <SortIcon
                        column="type"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'capacity',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('capacity')}
                      type="button"
                    >
                      {t('navigator.classrooms.capacity')}
                      <SortIcon
                        column="capacity"
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
                      {t('navigator.classrooms.storey')}
                      <SortIcon
                        column="storey"
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
                      {t('navigator.classrooms.rotation')}
                      <SortIcon
                        column="rotation"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.classrooms.size')}</TableHead>
                  <TableHead>{t('navigator.classrooms.description')}</TableHead>
                  <TableHead>{t('navigator.classrooms.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClassrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell className="font-medium">
                      {classroom.name}
                    </TableCell>
                    <TableCell>{classroom.buildingName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {classroom.typeColorhex && (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: classroom.typeColorhex }}
                          />
                        )}
                        {classroom.typeName}
                      </span>
                    </TableCell>
                    <TableCell>{classroom.capacity}</TableCell>
                    <TableCell>{classroom.storey}</TableCell>
                    <TableCell>{classroom.rotation}</TableCell>
                    <TableCell>
                      {classroom.sizeX}×{classroom.sizeY}×{classroom.sizeZ}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {classroom.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedClassroom(classroom);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(classroom)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!(filteredClassrooms.length || hasError) && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={9}>
                      {t('navigator.classrooms.noClassroomsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <ClassroomDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedClassroom(null);
          }
        }}
        open={dialogOpen}
        record={selectedClassroom}
      />
    </div>
  );
}

function getClassroomSortValue(
  classroom: ClassroomRow,
  column: ClassroomSortColumn
): string | number {
  switch (column) {
    case 'name':
      return classroom.name;
    case 'building':
      return classroom.buildingName;
    case 'type':
      return classroom.typeName;
    case 'capacity':
      return classroom.capacity;
    case 'storey':
      return classroom.storey;
    case 'rotation':
      return classroom.rotation;
    default:
      return '';
  }
}
