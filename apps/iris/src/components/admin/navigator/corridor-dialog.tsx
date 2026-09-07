import { useForm } from '@tanstack/react-form';
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
  type NavigatorCorridor,
  useBuildings,
  useUpsertCorridor,
} from '@/hooks/navigator';
import { navigatorCorridorSchema } from '@/utils/form-schemas';
import {
  asNavigatorFormValidator,
  type CorridorDialogProps,
  selectPlaceholder,
} from './types';

const initialState = (record: NavigatorCorridor | null) => ({
  barrierFree: record?.barrierFree ?? false,
  buildingId: record?.buildingId ?? '',
  isOutdoor: record?.isOutdoor ?? false,
  name: record?.name ?? '',
  storey: record ? String(record.storey) : '',
  width: record ? String(record.width) : '',
  x1: record ? String(record.x1) : '',
  x2: record ? String(record.x2) : '',
  y1: record ? String(record.y1) : '',
  y2: record ? String(record.y2) : '',
});

type CorridorFormValues = ReturnType<typeof initialState>;

export function CorridorDialog({
  record,
  open,
  onOpenChange,
}: CorridorDialogProps) {
  const { t } = useTranslation();
  const buildingsQuery = useBuildings();
  const upsert = useUpsertCorridor({ onSaved: () => onOpenChange(false) });

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

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      const payload = {
        barrierFree: value.barrierFree,
        buildingId: value.buildingId,
        isOutdoor: value.isOutdoor,
        name: value.name.trim(),
        storey: Number(value.storey),
        width: Number(value.width),
        x1: Number(value.x1),
        x2: Number(value.x2),
        y1: Number(value.y1),
        y2: Number(value.y2),
      };
      upsert.mutate(record ? { id: record.id, payload } : { payload });
    },
    validators: {
      onSubmit: asNavigatorFormValidator<CorridorFormValues>(
        navigatorCorridorSchema
      ),
    },
  });

  useEffect(() => {
    form.reset(initialState(record));
  }, [record, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {record
              ? t('navigator.corridors.editTitle')
              : t('navigator.corridors.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
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
                    {t('navigator.corridors.width')}
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
                    {t('navigator.corridors.x1')}
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
                    {t('navigator.corridors.y1')}
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
                    {t('navigator.corridors.x2')}
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
                    {t('navigator.corridors.y2')}
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
                  {t('navigator.corridors.barrierFree')}
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
                  {t('navigator.corridors.isOutdoor')}
                </label>
              )}
            </form.Field>
          </div>
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
