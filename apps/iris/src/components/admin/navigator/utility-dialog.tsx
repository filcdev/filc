import { useForm, useStore } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type NavigatorUtility,
  type UtilityPayload,
  useBuildings,
  useUpsertUtility,
} from '@/hooks/navigator';
import { navigatorUtilitySchema } from '@/utils/form-schemas';
import {
  asNavigatorFormValidator,
  selectPlaceholder,
  type UtilityDialogProps,
} from './types';

type UtilityKind = 'corridor' | 'lift' | 'stair';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mechanical mapping of a nullable record into string form values
const initialState = (record: NavigatorUtility | null) => ({
  barrierFree: record?.kind === 'corridor' && (record.barrierFree ?? false),
  buildingId: record?.buildingId ?? '',
  isOutdoor: record?.kind === 'corridor' && (record.isOutdoor ?? false),
  kind: (record?.kind as UtilityKind | undefined) ?? 'corridor',
  maxStorey: record ? String(record.maxStorey ?? '') : '',
  minStorey: record ? String(record.minStorey ?? '') : '',
  name: record?.name ?? '',
  rotation: record ? String(record.rotation ?? '') : '',
  storey: record ? String(record.storey ?? '') : '',
  width: record ? String(record.width ?? '') : '',
  x: record ? String(record.x ?? '') : '',
  x1: record ? String(record.x1 ?? '') : '',
  x2: record ? String(record.x2 ?? '') : '',
  y: record ? String(record.y ?? '') : '',
  y1: record ? String(record.y1 ?? '') : '',
  y2: record ? String(record.y2 ?? '') : '',
});

type UtilityFormValues = ReturnType<typeof initialState>;

function buildPayload(value: UtilityFormValues): UtilityPayload {
  const common = {
    buildingId: value.buildingId,
    name: value.name.trim(),
  };

  if (value.kind === 'corridor') {
    return {
      ...common,
      barrierFree: value.barrierFree,
      isOutdoor: value.isOutdoor,
      kind: 'corridor',
      storey: Number(value.storey),
      width: Number(value.width),
      x1: Number(value.x1),
      x2: Number(value.x2),
      y1: Number(value.y1),
      y2: Number(value.y2),
    };
  }

  if (value.kind === 'lift') {
    return {
      ...common,
      kind: 'lift',
      maxStorey: Number(value.maxStorey),
      minStorey: Number(value.minStorey),
      x: Number(value.x),
      y: Number(value.y),
    };
  }

  return {
    ...common,
    kind: 'stair',
    maxStorey: Number(value.maxStorey),
    minStorey: Number(value.minStorey),
    rotation: Number(value.rotation),
    x: Number(value.x),
    y: Number(value.y),
  };
}

export function UtilityDialog({
  record,
  open,
  onOpenChange,
}: UtilityDialogProps) {
  const { t } = useTranslation();
  const buildingsQuery = useBuildings();
  const upsert = useUpsertUtility({ onSaved: () => onOpenChange(false) });

  const buildingItems = (buildingsQuery.data?.buildings ?? []).map((b) => ({
    label: b.name,
    value: b.id,
  }));

  const buildingPlaceholder = selectPlaceholder(
    buildingsQuery.isLoading,
    buildingItems.length === 0,
    t('common.loading'),
    t('navigator.common.noBuildings'),
    t('navigator.common.selectBuilding')
  );

  const kindItems = (['corridor', 'lift', 'stair'] as const).map((k) => ({
    label: t(`navigator.utilities.kinds.${k}`),
    value: k,
  }));

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      upsert.mutate(
        record
          ? { id: record.id, payload: buildPayload(value) }
          : { payload: buildPayload(value) }
      );
    },
    validators: {
      onSubmit: asNavigatorFormValidator<UtilityFormValues>(
        navigatorUtilitySchema
      ),
    },
  });

  const kind = useStore(form.store, (state) => state.values.kind);

  useEffect(() => {
    form.reset(initialState(record));
  }, [record, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {record
              ? t('navigator.utilities.editTitle')
              : t('navigator.utilities.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="kind">
            {(field) => (
              <Field>
                <FieldLabel>{t('navigator.utilities.kind')}</FieldLabel>
                <Select
                  items={kindItems}
                  onValueChange={(value) =>
                    field.handleChange((value ?? 'corridor') as UtilityKind)
                  }
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('navigator.utilities.kind')} />
                  </SelectTrigger>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.common.name')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="buildingId">
            {(field) => (
              <Field>
                <FieldLabel>{t('navigator.common.building')}</FieldLabel>
                <Select
                  items={buildingItems}
                  onValueChange={(value) => field.handleChange(value ?? '')}
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={buildingPlaceholder} />
                  </SelectTrigger>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {kind === 'corridor' && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <form.Field name="storey">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.common.storey')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="width">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.utilities.width')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="x1">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.utilities.x1')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="y1">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.utilities.y1')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="x2">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.utilities.x2')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="y2">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.utilities.y2')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <form.Field name="barrierFree">
                  {(field) => (
                    <label
                      className="flex items-center gap-2 text-sm"
                      htmlFor={field.name}
                    >
                      <Checkbox
                        checked={field.state.value}
                        id={field.name}
                        onCheckedChange={(checked) =>
                          field.handleChange(Boolean(checked))
                        }
                      />
                      {t('navigator.utilities.barrierFree')}
                    </label>
                  )}
                </form.Field>
                <form.Field name="isOutdoor">
                  {(field) => (
                    <label
                      className="flex items-center gap-2 text-sm"
                      htmlFor={field.name}
                    >
                      <Checkbox
                        checked={field.state.value}
                        id={field.name}
                        onCheckedChange={(checked) =>
                          field.handleChange(Boolean(checked))
                        }
                      />
                      {t('navigator.utilities.isOutdoor')}
                    </label>
                  )}
                </form.Field>
              </div>
            </>
          )}

          {(kind === 'lift' || kind === 'stair') && (
            <div className="grid gap-4 md:grid-cols-2">
              <form.Field name="minStorey">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('navigator.common.minStorey')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="number"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="maxStorey">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('navigator.common.maxStorey')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="number"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="x">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('navigator.common.x')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="number"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="y">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('navigator.common.y')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="number"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              {kind === 'stair' && (
                <form.Field name="rotation">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('navigator.common.rotation')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!form.state.canSubmit || upsert.isPending}
              type="submit"
            >
              {record
                ? t('navigator.common.save')
                : t('navigator.common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
