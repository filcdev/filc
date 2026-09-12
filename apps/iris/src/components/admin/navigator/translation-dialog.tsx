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
import {
  type NavigatorTranslation,
  useCreateTranslation,
  useUpdateTranslation,
} from '@/hooks/navigator';
import { navigatorTranslationSchema } from '@/utils/form-schemas';
import type { TranslationDialogProps } from './types';

const initialState = (record: NavigatorTranslation | null) => ({
  langKey: record?.langKey ?? '',
  text: record?.text ?? '',
  textKey: record?.textKey ?? '',
});

export function TranslationDialog({
  record,
  open,
  onOpenChange,
}: TranslationDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== null;

  const createTranslation = useCreateTranslation({
    onSaved: () => onOpenChange(false),
  });
  const updateTranslation = useUpdateTranslation({
    onSaved: () => onOpenChange(false),
  });

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      if (record) {
        updateTranslation.mutate({
          key: record.textKey,
          lang: record.langKey,
          payload: { text: value.text },
        });
      } else {
        createTranslation.mutate({
          langKey: value.langKey.trim(),
          text: value.text,
          textKey: value.textKey.trim(),
        });
      }
    },
    validators: { onSubmit: navigatorTranslationSchema },
  });

  useEffect(() => {
    form.reset(initialState(record));
  }, [record, form.reset]);

  const isPending = createTranslation.isPending || updateTranslation.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('navigator.translations.editTitle')
              : t('navigator.translations.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="langKey">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.translations.langKey')}
                </FieldLabel>
                <Input
                  disabled={isEdit}
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="textKey">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.translations.textKey')}
                </FieldLabel>
                <Input
                  disabled={isEdit}
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="text">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.translations.text')}
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
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={!form.state.canSubmit || isPending} type="submit">
              {isEdit
                ? t('navigator.common.save')
                : t('navigator.common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
