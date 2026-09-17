import type { Lift } from '@filcdev/api/domains/navigator/lift';
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
  useCreateLift,
  useDeleteLift,
  useLifts,
  useNavigatorGraph,
  useUpdateLift,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/lifts')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <LiftsPage />
    </PermissionGuard>
  ),
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
        updateLift.mutate({ id, payload });
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.lifts.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.lifts.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => lifts.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          {!editor.isEditing && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {t('navigator.lifts.add')}
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
                  onDelete={(lift) => deleteLift.mutate(lift.id)}
                  onEdit={startEdit}
                  onHover={(lift) => editor.setHoveredId(lift?.id ?? null)}
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
