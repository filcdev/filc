import type { Building } from '@filcdev/api/domains/navigator/building';
import { permissions } from '@filcdev/api/permissions';
import EditorView3D from '@filcdev/navigator-3d/editor-view';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { useNavigatorEditor } from '@/components/admin/navigator/use-navigator-editor';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  useBuildings,
  useCreateBuilding,
  useDeleteBuilding,
  useNavigatorGraph,
  useUpdateBuilding,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/buildings')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <BuildingsPage />
    </PermissionGuard>
  ),
});

type BuildingFormValues = {
  description: string;
  id?: string;
  name: string;
  x: number;
  y: number;
};

const emptyBuilding: BuildingFormValues = {
  description: '',
  name: '',
  x: 0,
  y: 0,
};

function BuildingsPage() {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();
  const buildings = useBuildings();

  const form = useForm({
    defaultValues: emptyBuilding,
    onSubmit: ({ value }) => {
      const { id, ...payload } = value;
      if (id) {
        updateBuilding.mutate({ id, payload });
      } else {
        createBuilding.mutate(payload);
      }
    },
  });

  const editor = useNavigatorEditor({
    form,
    kind: 'building',
    toPreview: (values: BuildingFormValues) => ({
      description: values.description,
      name: values.name,
      x: values.x,
      y: values.y,
    }),
  });

  const createBuilding = useCreateBuilding({ onSaved: editor.closeEdit });
  const updateBuilding = useUpdateBuilding({ onSaved: editor.closeEdit });
  const deleteBuilding = useDeleteBuilding();

  const startCreate = () => {
    editor.beginEdit({ ...emptyBuilding });
  };

  const startEdit = (building: Building) => {
    editor.beginEdit({ ...building });
  };

  const columns: EntityTableColumn<Building>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (building) => (
        <div className="flex items-center gap-2">
          <span>{building.name}</span>
          {!building.mapped && (
            <Badge className="text-muted-foreground" variant="outline">
              {t('navigator.notPlaced')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: t('navigator.fields.description'),
      key: 'description',
      render: (building) => building.description,
    },
    {
      header: t('navigator.fields.x'),
      key: 'x',
      render: (building) => building.x,
    },
    {
      header: t('navigator.fields.y'),
      key: 'y',
      render: (building) => building.y,
    },
  ];

  const isSaving = createBuilding.isPending || updateBuilding.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.buildings.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.buildings.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => buildings.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          {!editor.isEditing && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {t('navigator.buildings.add')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          {editor.isEditing ? (
            <form
              className="space-y-4"
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
            <QueryBoundary data={buildings.data} query={buildings}>
              {(rows) => (
                <EntityTable
                  columns={columns}
                  getRowId={(building) => building.id}
                  getRowLabel={(building) => building.name}
                  onDelete={(building) => deleteBuilding.mutate(building.id)}
                  onEdit={startEdit}
                  onHover={(building) =>
                    editor.setHoveredId(building?.id ?? null)
                  }
                  rows={rows}
                />
              )}
            </QueryBoundary>
          )}
        </div>

        <div className="h-[70vh] overflow-hidden rounded-xl border">
          <EditorView3D
            appearance={editor.appearance}
            edit={editor.edit}
            emptyLabel={t('ui.common.no_data')}
            graph={graph.data ?? null}
            initialDistance={120}
            onTransform={editor.foldPatch}
            showAxes
          />
        </div>
      </div>
    </div>
  );
}
