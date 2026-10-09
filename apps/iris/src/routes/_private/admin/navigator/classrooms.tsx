import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { useNavigatorEditor } from '@/components/admin/navigator/use-navigator-editor';
import { Lazy } from '@/components/lazy';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  type ClassroomRow,
  useBuildings,
  useClassrooms,
  useClassroomTypes,
  useCreateClassroom,
  useDeleteClassroom,
  useNavigatorGraph,
  useUpdateClassroom,
} from '@/hooks/navigator';
import { orpc, prefetch } from '@/utils/orpc';

// The 3D editor is three.js (~560 kB). It is the bulk of this page, so it
// loads into its own chunk instead of with the route that hosts the preview.
const loadEditorView3D = () => import('@filcdev/navigator-3d/editor-view');

export const Route = createFileRoute('/_private/admin/navigator/classrooms')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <ClassroomsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.navigator.classrooms.list.queryOptions()
      ),
      prefetch(
        context.queryClient,
        orpc.navigator.buildings.list.queryOptions()
      ),
      prefetch(context.queryClient, orpc.navigator.graph.queryOptions()),
    ]),
});

type ClassroomFormValues = {
  building_id: string;
  capacity: number;
  description: string;
  id?: string;
  name: string;
  rotation: number;
  short: string;
  size_x: number;
  size_y: number;
  size_z: number;
  storey: number;
  type_id: string;
  x: number;
  y: number;
};

const emptyClassroom: ClassroomFormValues = {
  building_id: '',
  capacity: 0,
  description: '',
  name: '',
  rotation: 0,
  short: '',
  size_x: 6,
  size_y: 6,
  size_z: 3,
  storey: 0,
  type_id: '',
  x: 0,
  y: 0,
};

function ClassroomsPage() {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();
  const buildings = useBuildings();
  const classroomTypes = useClassroomTypes();
  const classrooms = useClassrooms();

  const form = useForm({
    defaultValues: emptyClassroom,
    onSubmit: ({ value }) => {
      const { id, ...payload } = value;
      if (id) {
        updateClassroom.mutate({ ...payload, id });
      } else {
        createClassroom.mutate(payload);
      }
    },
  });

  const editor = useNavigatorEditor({
    form,
    kind: 'classroom',
    toPreview: (values: ClassroomFormValues) => ({ ...values }),
  });

  const createClassroom = useCreateClassroom({ onSaved: editor.closeEdit });
  const updateClassroom = useUpdateClassroom({ onSaved: editor.closeEdit });
  const deleteClassroom = useDeleteClassroom();

  const buildingItems = (buildings.data ?? []).map((building) => ({
    label: building.name,
    value: building.id,
  }));
  const typeItems = (classroomTypes.data ?? []).map((type) => ({
    label: type.name,
    value: type.id,
  }));

  const buildingNames: Record<string, string> = Object.fromEntries(
    (buildings.data ?? []).map((building) => [building.id, building.name])
  );
  const typeNames: Record<string, string> = Object.fromEntries(
    (classroomTypes.data ?? []).map((type) => [type.id, type.name])
  );

  const startCreate = () => {
    const defaults: ClassroomFormValues = {
      ...emptyClassroom,
      building_id: buildings.data?.[0]?.id ?? '',
      type_id: classroomTypes.data?.[0]?.id ?? '',
    };
    editor.beginEdit(defaults);
  };

  const startEdit = (classroom: ClassroomRow) => {
    // A room the timetable imported has neither the campus capacity nor a
    // type yet; the form cannot show `null`, so it starts from empty ones.
    editor.beginEdit({
      ...classroom,
      capacity: classroom.capacity ?? 0,
      type_id: classroom.type_id ?? '',
    });
  };

  const columns: EntityTableColumn<ClassroomRow>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (classroom) => (
        <div className="flex items-center gap-2">
          <span>{classroom.name}</span>
          {!classroom.mapped && (
            <Badge className="text-muted-foreground" variant="outline">
              {t('navigator.notPlaced')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: t('navigator.fields.short'),
      key: 'short',
      render: (classroom) => classroom.short,
    },
    {
      header: t('navigator.fields.building'),
      key: 'building',
      render: (classroom) =>
        buildingNames[classroom.building_id] ?? t('ui.common.unknown'),
    },
    {
      header: t('navigator.fields.type'),
      key: 'type',
      render: (classroom) =>
        classroom.type_id
          ? (typeNames[classroom.type_id] ?? t('ui.common.unknown'))
          : t('ui.common.unknown'),
    },
    {
      header: t('navigator.fields.storey'),
      key: 'storey',
      render: (classroom) => classroom.storey,
    },
    {
      header: t('navigator.fields.capacity'),
      key: 'capacity',
      render: (classroom) => classroom.capacity,
    },
  ];

  const isSaving = createClassroom.isPending || updateClassroom.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.classrooms.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.classrooms.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => classrooms.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          {!editor.isEditing && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {t('navigator.classrooms.add')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          {editor.isEditing ? (
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="name">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.name')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="short">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.short')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="description">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.description')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="building_id">
                  {(field) => (
                    <Field>
                      <FieldLabel>{t('navigator.fields.building')}</FieldLabel>
                      <Select
                        items={buildingItems}
                        onValueChange={(value) =>
                          field.handleChange(value ?? '')
                        }
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('navigator.fields.building')}
                          />
                        </SelectTrigger>
                      </Select>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="type_id">
                  {(field) => (
                    <Field>
                      <FieldLabel>{t('navigator.fields.type')}</FieldLabel>
                      <Select
                        items={typeItems}
                        onValueChange={(value) =>
                          field.handleChange(value ?? '')
                        }
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('navigator.fields.type')}
                          />
                        </SelectTrigger>
                      </Select>
                    </Field>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="storey">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.storey')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="capacity">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.capacity')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="rotation">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.rotation')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="x">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.x')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="y">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.y')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="size_x">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.sizeX')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="size_y">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.sizeY')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="size_z">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.sizeZ')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>

              <div className="flex items-center gap-2">
                <Button disabled={isSaving} type="submit">
                  {isSaving ? t('common.loading') : t('common.save')}
                </Button>
                <Button
                  onClick={editor.closeEdit}
                  type="button"
                  variant="outline"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            <QueryBoundary data={classrooms.data} query={classrooms}>
              {(rows) => (
                <EntityTable
                  columns={columns}
                  getRowId={(classroom) => classroom.id}
                  getRowLabel={(classroom) => classroom.name}
                  onDelete={(classroom) =>
                    deleteClassroom.mutate({ id: classroom.id })
                  }
                  onEdit={startEdit}
                  onHover={(classroom) =>
                    editor.setHoveredId(classroom?.id ?? null)
                  }
                  rows={rows}
                />
              )}
            </QueryBoundary>
          )}
        </div>

        <div className="h-[70vh] overflow-hidden rounded-xl border">
          <Lazy
            appearance={editor.appearance}
            edit={editor.edit}
            emptyLabel={t('ui.common.no_data')}
            graph={graph.data ?? null}
            initialDistance={120}
            load={loadEditorView3D}
            onTransform={editor.foldPatch}
            showAxes
          />
        </div>
      </div>
    </div>
  );
}
