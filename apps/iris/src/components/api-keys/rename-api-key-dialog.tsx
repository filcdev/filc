import { Button } from '@filcdev/ui/components/button';
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
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import { type UserApiKey, useUpdateApiKey } from '@/hooks/api-keys';
import {
  API_KEY_NAME_MAX_LENGTH,
  renameApiKeySchema,
} from '@/utils/form-schemas';

type RenameApiKeyDialogProps = BaseDialogProps & {
  apiKey: UserApiKey;
};

/** Rename a key. The secret itself never changes, so it is not shown here. */
export function RenameApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
}: RenameApiKeyDialogProps) {
  const { t } = useTranslation();

  const updateApiKey = useUpdateApiKey({ onSaved: () => onOpenChange(false) });

  const form = useForm({
    defaultValues: { name: apiKey.name ?? '' },
    onSubmit: ({ value }) => {
      updateApiKey.mutate({ keyId: apiKey.id, name: value.name.trim() });
    },
    validators: { onSubmit: renameApiKeySchema },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('apiKeys.renameTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
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
                  id={field.name}
                  maxLength={API_KEY_NAME_MAX_LENGTH}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('apiKeys.namePlaceholder')}
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
            <Button disabled={!form.state.canSubmit} type="submit">
              {updateApiKey.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
