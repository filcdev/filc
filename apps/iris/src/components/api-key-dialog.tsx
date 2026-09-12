import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createApiKeySchema } from '@/utils/form-schemas';

export type CreateApiKeyValues = {
  name: string;
  expiresAt?: Date;
};

type ApiKeyDialogProps = {
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateApiKeyValues) => void;
  open: boolean;
};

const initialState: CreateApiKeyValues = {
  expiresAt: undefined,
  name: '',
};

export function ApiKeyDialog({
  onOpenChange,
  onSubmit,
  open,
}: ApiKeyDialogProps) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: initialState,
    onSubmit: ({ value }) => {
      onSubmit({ expiresAt: value.expiresAt, name: value.name.trim() });
    },
    validators: {
      onSubmit: createApiKeySchema,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(initialState);
    }
  }, [open, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('apiKeys.createTitle')}</DialogTitle>
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
                  {t('apiKeys.nameLabel')}
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('apiKeys.namePlaceholder')}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="expiresAt">
            {(field) => (
              <Field>
                <FieldLabel>{t('apiKeys.expiresLabel')}</FieldLabel>
                <DatePicker
                  date={field.state.value}
                  onDateChange={field.handleChange}
                  placeholder={t('apiKeys.expiresPlaceholder')}
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
            <Button disabled={!form.state.canSubmit} type="submit">
              {t('apiKeys.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
