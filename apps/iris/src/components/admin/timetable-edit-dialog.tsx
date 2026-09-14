import { Button } from '@filcdev/ui/components/button';
import { DatePicker } from '@filcdev/ui/components/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm } from '@tanstack/react-form';
import { Save } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TimetableRow,
  useUpdateTimetable,
} from '@/hooks/timetables-admin';
import { getIntlLocale } from '@/utils/date-locale';
import { timetableEditSchema } from '@/utils/form-schemas';
import type { BaseDialogProps } from './admin.types';

type TimetableEditDialogProps = BaseDialogProps & {
  item?: TimetableRow | null;
};

export function TimetableEditDialog({
  item,
  onOpenChange,
  open,
}: TimetableEditDialogProps) {
  const { i18n, t } = useTranslation();

  const updateMutation = useUpdateTimetable({
    onSaved: () => onOpenChange(false),
  });

  const form = useForm({
    defaultValues: {
      name: item?.name ?? '',
      validFrom: item?.validFrom ? new Date(item.validFrom) : undefined,
      validTo: item?.validTo ? new Date(item.validTo) : undefined,
    },
    onSubmit: async ({ value }) => {
      if (!item) {
        return;
      }
      await updateMutation.mutateAsync({
        id: item.id,
        payload: {
          name: value.name.trim() || undefined,
          validFrom: value.validFrom?.toISOString().slice(0, 10),
          validTo: value.validTo
            ? value.validTo.toISOString().slice(0, 10)
            : null,
        },
      });
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = timetableEditSchema.safeParse(value);
        if (!result.success) {
          return result.error.issues.map((i) => i.message).join(', ');
        }
        return undefined;
      },
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: item?.name ?? '',
        validFrom: item?.validFrom ? new Date(item.validFrom) : undefined,
        validTo: item?.validTo ? new Date(item.validTo) : undefined,
      });
    }
  }, [open, item, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('timetable.editTitle')}: {item?.name}
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
                  {t('timetable.nameLabel')}
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('timetable.importNamePlaceholder')}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="validFrom">
            {(field) => (
              <Field>
                <FieldLabel>{t('timetable.validFromLabel')}</FieldLabel>
                <DatePicker
                  date={field.state.value}
                  locale={getIntlLocale(i18n.language)}
                  onDateChange={field.handleChange}
                  placeholder={t('timetable.validFromPlaceholder')}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="validTo">
            {(field) => (
              <Field>
                <FieldLabel>{t('timetable.validToLabel')}</FieldLabel>
                <DatePicker
                  date={field.state.value}
                  locale={getIntlLocale(i18n.language)}
                  onDateChange={field.handleChange}
                  placeholder={t('timetable.validToPlaceholder')}
                />
                <p className="text-muted-foreground text-xs">
                  {t('timetable.validToDescription')}
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <Button disabled={updateMutation.isPending} type="submit">
              <Save className="mr-2 h-4 w-4" />
              {t('substitution.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
