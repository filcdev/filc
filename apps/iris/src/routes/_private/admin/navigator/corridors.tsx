import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import {
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type ReactFormExtendedApi,
  useForm,
} from '@tanstack/react-form';
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
  useCorridors,
  useCreateCorridor,
  useDeleteCorridor,
  useNavigatorGraph,
  useUpdateCorridor,
} from '@/hooks/navigator';
import { orpc, prefetch } from '@/utils/orpc';

// The 3D editor is three.js (~560 kB). It is the bulk of this page, so it
// loads into its own chunk instead of with the route that hosts the preview.
const loadEditorView3D = () => import('@filcdev/navigator-3d/editor-view');

export const Route = createFileRoute('/_private/admin/navigator/corridors')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <CorridorsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.navigator.corridors.list.queryOptions()
      ),
      prefetch(
        context.queryClient,
        orpc.navigator.buildings.list.queryOptions()
      ),
      prefetch(context.queryClient, orpc.navigator.graph.queryOptions()),
    ]),
});

type CorridorFormValues = {
  barrier_free: boolean;
  building_id: string;
  id?: string;
  is_outdoor: boolean;
  name: string;
  storey: number;
  width: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

const emptyCorridor: CorridorFormValues = {
  barrier_free: false,
  building_id: '',
  is_outdoor: false,
  name: '',
  storey: 0,
  width: 0,
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 0,
};

function CorridorsPage() {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();
  const buildings = useBuildings();
  const corridors = useCorridors();

  const form = useForm({
    defaultValues: emptyCorridor,
    onSubmit: ({ value }) => {
      const { id, ...payload } = value;
      if (id) {
        updateCorridor.mutate({ ...payload, id });
      } else {
        createCorridor.mutate(payload);
      }
    },
  });

  const editor = useNavigatorEditor({
    form,
    kind: 'corridor',
    toPreview: (values: CorridorFormValues) => ({ ...values }),
  });

  const createCorridor = useCreateCorridor({ onSaved: editor.closeEdit });
  const updateCorridor = useUpdateCorridor({ onSaved: editor.closeEdit });
  const deleteCorridor = useDeleteCorridor();

  const buildingItems = (buildings.data ?? []).map((building) => ({
    label: building.name,
    value: building.id,
  }));
  const buildingNames: Record<string, string> = Object.fromEntries(
    (buildings.data ?? []).map((building) => [building.id, building.name])
  );

  const startCreate = () => {
    const defaults: CorridorFormValues = {
      ...emptyCorridor,
      building_id: buildings.data?.[0]?.id ?? '',
    };
    editor.beginEdit(defaults);
  };

  const startEdit = (corridor: Corridor) => {
    editor.beginEdit({ ...corridor });
  };

  const columns: EntityTableColumn<Corridor>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (corridor) => corridor.name,
    },
    {
      header: t('navigator.fields.building'),
      key: 'building',
      render: (corridor) =>
        buildingNames[corridor.building_id] ?? t('ui.common.unknown'),
    },
    {
      header: t('navigator.fields.storey'),
      key: 'storey',
      render: (corridor) => corridor.storey,
    },
    {
      header: t('navigator.fields.width'),
      key: 'width',
      render: (corridor) => corridor.width,
    },
    {
      header: t('navigator.fields.barrierFree'),
      key: 'barrier_free',
      render: (corridor) =>
        corridor.barrier_free ? t('common.yes') : t('common.no'),
    },
    {
      header: t('navigator.fields.isOutdoor'),
      key: 'is_outdoor',
      render: (corridor) =>
        corridor.is_outdoor ? t('common.yes') : t('common.no'),
    },
  ];

  const isSaving = createCorridor.isPending || updateCorridor.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        addLabel={t('navigator.corridors.add')}
        canAdd={!editor.isEditing}
        description={t('navigator.corridors.description')}
        onAdd={startCreate}
        onRefresh={() => corridors.refetch()}
        title={t('navigator.corridors.title')}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          {editor.isEditing ? (
            <CorridorEditorForm
              buildingItems={buildingItems}
              form={form}
              isSaving={isSaving}
              onCancel={editor.closeEdit}
            />
          ) : (
            <QueryBoundary data={corridors.data} query={corridors}>
              {(rows) => (
                <EntityTable
                  columns={columns}
                  getRowId={(corridor) => corridor.id}
                  getRowLabel={(corridor) => corridor.name}
                  onDelete={(corridor) =>
                    deleteCorridor.mutate({ id: corridor.id })
                  }
                  onEdit={startEdit}
                  onHover={(corridor) =>
                    editor.setHoveredId(corridor?.id ?? null)
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

type SyncValidator = FormValidateOrFn<CorridorFormValues> | undefined;
type AsyncValidator = FormAsyncValidateOrFn<CorridorFormValues> | undefined;

/**
 * The page's form API. TanStack's validator generics are invariant, so the
 * exact instantiation has to be named for the field group below to accept it.
 */
type CorridorFormApi = ReactFormExtendedApi<
  CorridorFormValues,
  SyncValidator,
  SyncValidator,
  AsyncValidator,
  SyncValidator,
  AsyncValidator,
  SyncValidator,
  AsyncValidator,
  SyncValidator,
  AsyncValidator,
  AsyncValidator,
  unknown
>;

type CorridorEditorFormProps = {
  buildingItems: { label: string; value: string }[];
  form: CorridorFormApi;
  isSaving: boolean;
  onCancel: () => void;
};

/** Every field the 3D editor can drive, in the same values the gizmo patches. */
function CorridorEditorForm({
  buildingItems,
  form,
  isSaving,
  onCancel,
}: CorridorEditorFormProps) {
  const { t } = useTranslation();

  return (
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
                onChange={(event) => field.handleChange(event.target.value)}
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
        <form.Field name="width">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.width')}
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

      <div className="grid gap-4 sm:grid-cols-4">
        <form.Field name="x1">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.x1')}
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
        <form.Field name="y1">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.y1')}
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
        <form.Field name="x2">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.x2')}
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
        <form.Field name="y2">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.y2')}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="barrier_free">
          {(field) => (
            <Field orientation="horizontal">
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.barrierFree')}
              </FieldLabel>
              <Checkbox
                checked={field.state.value}
                id={field.name}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="is_outdoor">
          {(field) => (
            <Field orientation="horizontal">
              <FieldLabel htmlFor={field.name}>
                {t('navigator.fields.isOutdoor')}
              </FieldLabel>
              <Checkbox
                checked={field.state.value}
                id={field.name}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
            </Field>
          )}
        </form.Field>
      </div>

      <div className="flex items-center gap-2">
        <Button disabled={isSaving} type="submit">
          {isSaving ? t('common.loading') : t('common.save')}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
