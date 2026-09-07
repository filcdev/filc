import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
  type NavigatorLift,
  useBuildings,
  useUpsertLift,
} from '@/hooks/navigator';
import { navigatorLiftSchema } from '@/utils/form-schemas';
import {
  asNavigatorFormValidator,
  type LiftDialogProps,
  selectPlaceholder,
} from './types';

const initialState = (record: NavigatorLift | null) => ({
  buildingId: record?.buildingId ?? '',
  maxStorey: record ? String(record.maxStorey) : '',
  minStorey: record ? String(record.minStorey) : '',
  name: record?.name ?? '',
  x: record ? String(record.x) : '',
  y: record ? String(record.y) : '',
});

type LiftFormValues = ReturnType<typeof initialState>;

export function LiftDialog({ record, open, onOpenChange }: LiftDialogProps) {
  const { t } = useTranslation();
  const buildingsQuery = useBuildings();
  const upsert = useUpsertLift({ onSaved: () => onOpenChange(false) });

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
        buildingId: value.buildingId,
        maxStorey: Number(value.maxStorey),
        minStorey: Number(value.minStorey),
        name: value.name.trim(),
        x: Number(value.x),
        y: Number(value.y),
      };
      upsert.mutate(record ? { id: record.id, payload } : { payload });
    },
    validators: {
      onSubmit: asNavigatorFormValidator<LiftFormValues>(navigatorLiftSchema),
    },
  });

  useEffect(() => {
    form.reset(initialState(record));
  }, [record, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {record
              ? t('navigator.lifts.editTitle')
              : t('navigator.lifts.createTitle')}
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
