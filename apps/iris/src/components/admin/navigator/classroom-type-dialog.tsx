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
import {
  type NavigatorClassroomType,
  useUpsertClassroomType,
} from '@/hooks/navigator';
import { navigatorClassroomTypeSchema } from '@/utils/form-schemas';
import {
  asNavigatorFormValidator,
  type ClassroomTypeDialogProps,
} from './types';

const initialState = (record: NavigatorClassroomType | null) => ({
  colorhex: record?.colorhex ?? null,
  name: record?.name ?? '',
});

type ClassroomTypeFormValues = ReturnType<typeof initialState>;

export function ClassroomTypeDialog({
  record,
  open,
  onOpenChange,
}: ClassroomTypeDialogProps) {
  const { t } = useTranslation();
  const upsert = useUpsertClassroomType({ onSaved: () => onOpenChange(false) });

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      const payload = {
        colorhex: value.colorhex,
        name: value.name.trim(),
      };
      upsert.mutate(record ? { id: record.id, payload } : { payload });
    },
    validators: {
      onSubmit: asNavigatorFormValidator<ClassroomTypeFormValues>(
        navigatorClassroomTypeSchema
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
              ? t('navigator.classroomTypes.editTitle')
              : t('navigator.classroomTypes.createTitle')}
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
          <form.Field name="colorhex">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.classroomTypes.colorhex')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value === '' ? null : e.target.value
                    )
                  }
                  placeholder="#RRGGBBAA"
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
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
