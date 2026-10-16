import type { Lift } from '@filcdev/api/domains/navigator/lift';
import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { LabeledSelectField } from '@/components/admin/navigator/labeled-select-field';
import { useNavigatorEditor } from '@/components/admin/navigator/use-navigator-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Lazy } from '@/components/lazy';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  useBuildings,
  useCreateLift,
  useDeleteLift,
  useLifts,
  useNavigatorGraph,
  useUpdateLift,
} from '@/hooks/navigator';
import { orpc, prefetch } from '@/utils/orpc';

// The 3D editor is three.js (~560 kB). It is the bulk of this page, so it
// loads into its own chunk instead of with the route that hosts the preview.
const loadEditorView3D = () => import('@filcdev/navigator-3d/editor-view');

export const Route = createFileRoute('/_private/admin/navigator/lifts')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <LiftsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(context.queryClient, orpc.navigator.lifts.list.queryOptions()),
      prefetch(
        context.queryClient,
        orpc.navigator.buildings.list.queryOptions()
      ),
      prefetch(context.queryClient, orpc.navigator.graph.queryOptions()),
    ]),
});

type LiftFormValues = {
  building_id: string;
  id?: string;
  max_storey: number;
  min_storey: number;
  name: string;
  x: number;
  y: number;
};

const emptyLift: LiftFormValues = {
  building_id: '',
  max_storey: 1,
  min_storey: 0,
  name: '',
  x: 0,
  y: 0,
};

function LiftsPage() {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();
  const buildings = useBuildings();
  const lifts = useLifts();

  const form = useForm({
    defaultValues: emptyLift,
    onSubmit: ({ value }) => {
      const { id, ...payload } = value;
      if (id) {
        updateLift.mutate({ ...payload, id });
      } else {
        createLift.mutate(payload);
      }
    },
  });

  const editor = useNavigatorEditor({
    form,
    kind: 'lift',
    toPreview: (values: LiftFormValues) => ({ ...values }),
  });

  const createLift = useCreateLift({ onSaved: editor.closeEdit });
  const updateLift = useUpdateLift({ onSaved: editor.closeEdit });
  const deleteLift = useDeleteLift();

  const buildingItems = (buildings.data ?? []).map((building) => ({
    label: building.name,
    value: building.id,
  }));
  const buildingNames: Record<string, string> = Object.fromEntries(
    (buildings.data ?? []).map((building) => [building.id, building.name])
  );

  const startCreate = () => {
    const defaults: LiftFormValues = {
      ...emptyLift,
      building_id: buildings.data?.[0]?.id ?? '',
    };
    editor.beginEdit(defaults);
  };

  const startEdit = (lift: Lift) => {
    editor.beginEdit({ ...lift });
  };

  const columns: EntityTableColumn<Lift>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (lift) => lift.name,
    },
    {
      header: t('navigator.fields.building'),
      key: 'building',
      render: (lift) =>
        buildingNames[lift.building_id] ?? t('ui.common.unknown'),
    },
    {
      header: t('navigator.fields.minStorey'),
      key: 'min_storey',
      render: (lift) => lift.min_storey,
    },
    {
      header: t('navigator.fields.maxStorey'),
      key: 'max_storey',
      render: (lift) => lift.max_storey,
    },
  ];

  const isSaving = createLift.isPending || updateLift.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        addLabel={t('navigator.lifts.add')}
        canAdd={!editor.isEditing}
        description={t('navigator.lifts.description')}
        onAdd={startCreate}
        onRefresh={() => lifts.refetch()}
        title={t('navigator.lifts.title')}
      />

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
                    <LabeledSelectField
                      items={buildingItems}
                      label={t('navigator.fields.building')}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
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
            <QueryBoundary data={lifts.data} query={lifts}>
              {(rows) => (
                <EntityTable
                  columns={columns}
                  getRowId={(lift) => lift.id}
                  getRowLabel={(lift) => lift.name}
                  onDelete={(lift) => deleteLift.mutate({ id: lift.id })}
                  onEdit={startEdit}
                  onHover={(lift) => editor.setHoveredId(lift?.id ?? null)}
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
