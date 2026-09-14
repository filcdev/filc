import type { Stair } from '@filcdev/api/domains/navigator/stair';
import { permissions } from '@filcdev/api/permissions';
import EditorView3D from '@filcdev/navigator-3d/editor-view';
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
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  useBuildings,
  useCreateStair,
  useDeleteStair,
  useNavigatorGraph,
  useStairs,
  useUpdateStair,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/stairs')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <StairsPage />
    </PermissionGuard>
  ),
});

type StairFormValues = {
  building_id: string;
  id?: string;
  max_storey: number;
  min_storey: number;
  name: string;
  rotation: number;
  x: number;
  y: number;
};

const emptyStair: StairFormValues = {
  building_id: '',
  max_storey: 1,
  min_storey: 0,
  name: '',
  rotation: 0,
  x: 0,
  y: 0,
};

function StairsPage() {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();
  const buildings = useBuildings();
  const stairs = useStairs();

  const form = useForm({
    defaultValues: emptyStair,
    onSubmit: ({ value }) => {
      const { id, ...payload } = value;
      if (id) {
        updateStair.mutate({ id, payload });
      } else {
        createStair.mutate(payload);
      }
    },
  });

  const editor = useNavigatorEditor({
    form,
    kind: 'stairs',
    toPreview: (values: StairFormValues) => ({ ...values }),
  });

  const createStair = useCreateStair({ onSaved: editor.closeEdit });
  const updateStair = useUpdateStair({ onSaved: editor.closeEdit });
  const deleteStair = useDeleteStair();

  const buildingItems = (buildings.data ?? []).map((building) => ({
    label: building.name,
    value: building.id,
  }));
  const buildingNames: Record<string, string> = Object.fromEntries(
    (buildings.data ?? []).map((building) => [building.id, building.name])
  );

  const startCreate = () => {
    const defaults: StairFormValues = {
      ...emptyStair,
      building_id: buildings.data?.[0]?.id ?? '',
    };
    editor.beginEdit(defaults);
  };

  const startEdit = (stair: Stair) => {
    editor.beginEdit({ ...stair });
  };

  const columns: EntityTableColumn<Stair>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (stair) => stair.name,
    },
    {
      header: t('navigator.fields.building'),
      key: 'building',
      render: (stair) =>
        buildingNames[stair.building_id] ?? t('ui.common.unknown'),
    },
    {
      header: t('navigator.fields.minStorey'),
      key: 'min_storey',
      render: (stair) => stair.min_storey,
    },
    {
      header: t('navigator.fields.maxStorey'),
      key: 'max_storey',
      render: (stair) => stair.max_storey,
    },
    {
      header: t('navigator.fields.rotation'),
      key: 'rotation',
      render: (stair) => stair.rotation,
    },
  ];

  const isSaving = createStair.isPending || updateStair.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.stairs.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.stairs.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => stairs.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          {!editor.isEditing && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {t('navigator.stairs.add')}
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
                <form.Field name="min_storey">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.minStorey')}
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
                <form.Field name="max_storey">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.fields.maxStorey')}
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
            <QueryBoundary data={stairs.data} query={stairs}>
              {(rows) => (
                <EntityTable
                  columns={columns}
                  getRowId={(stair) => stair.id}
                  getRowLabel={(stair) => stair.name}
                  onDelete={(stair) => deleteStair.mutate(stair.id)}
                  onEdit={startEdit}
                  onHover={(stair) => editor.setHoveredId(stair?.id ?? null)}
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
