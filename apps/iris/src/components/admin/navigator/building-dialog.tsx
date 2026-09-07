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
import { Textarea } from '@/components/ui/textarea';
import { type NavigatorBuilding, useUpsertBuilding } from '@/hooks/navigator';
import { navigatorBuildingSchema } from '@/utils/form-schemas';
import { asNavigatorFormValidator, type BuildingDialogProps } from './types';

const initialState = (record: NavigatorBuilding | null) => ({
  description: record?.description ?? '',
  name: record?.name ?? '',
  x: record ? String(record.x) : '',
  y: record ? String(record.y) : '',
});

type BuildingFormValues = ReturnType<typeof initialState>;

export function BuildingDialog({
  record,
  open,
  onOpenChange,
}: BuildingDialogProps) {
  const { t } = useTranslation();
  const upsert = useUpsertBuilding({ onSaved: () => onOpenChange(false) });

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      const payload = {
        description: value.description,
        name: value.name.trim(),
        x: Number(value.x),
        y: Number(value.y),
      };
      upsert.mutate(record ? { id: record.id, payload } : { payload });
    },
    validators: {
      onSubmit: asNavigatorFormValidator<BuildingFormValues>(
        navigatorBuildingSchema
      ),
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
              ? t('navigator.buildings.editTitle')
              : t('navigator.buildings.createTitle')}
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
          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.common.description')}
                </FieldLabel>
                <Textarea
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <div className="grid gap-4 md:grid-cols-2">
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
