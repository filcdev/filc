import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { useForm } from '@tanstack/react-form';
import { Copy } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import { useCreateApiKey } from '@/hooks/api-keys';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  API_KEY_NAME_MAX_LENGTH,
  createApiKeySchema,
} from '@/utils/form-schemas';

/**
 * Expiry choices, as `expiresIn` in SECONDS — the unit better-auth's
 * `POST /api-key/create` expects. `never` leaves the field unset, which the
 * plugin stores as a null `expiresAt` (no expiry).
 */
const EXPIRY_OPTIONS = [
  { labelKey: 'apiKeys.expiryNever', seconds: undefined, value: 'never' },
  { labelKey: 'apiKeys.expiry30Days', seconds: 2_592_000, value: '30d' },
  { labelKey: 'apiKeys.expiry90Days', seconds: 7_776_000, value: '90d' },
  { labelKey: 'apiKeys.expiry1Year', seconds: 31_536_000, value: '1y' },
] as const;

/**
 * Create a key, then reveal the raw secret once.
 *
 * `create` is the only endpoint that ever returns the raw key — every later
 * read returns the hash — so the dialog refuses to dismiss itself until the
 * user acknowledges the reveal. Otherwise an Escape or a backdrop click would
 * discard the only copy of the secret.
 */
export function CreateApiKeyDialog({ open, onOpenChange }: BaseDialogProps) {
  const { t } = useTranslation();
  const secretId = useId();
  const copy = useCopyToClipboard();
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createApiKey = useCreateApiKey({
    onCreated: (apiKey) => setCreatedKey(apiKey.key),
  });

  const form = useForm({
    defaultValues: { expiresIn: 'never', name: '' },
    onSubmit: ({ value }) => {
      const seconds = EXPIRY_OPTIONS.find(
        (option) => option.value === value.expiresIn
      )?.seconds;
      createApiKey.mutate({ expiresIn: seconds, name: value.name.trim() });
    },
    validators: { onSubmit: createApiKeySchema },
  });

  const expiryItems = EXPIRY_OPTIONS.map((option) => ({
    label: t(option.labelKey),
    value: option.value,
  }));

  const handleOpenChange = (next: boolean) => {
    if (!next && createdKey !== null) {
      return;
    }
    onOpenChange(next);
  };

  if (createdKey !== null) {
    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('apiKeys.createdTitle')}</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>{t('apiKeys.revealWarningTitle')}</AlertTitle>
            <AlertDescription>{t('apiKeys.revealWarning')}</AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor={secretId}>{t('apiKeys.key')}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-xs"
                id={secretId}
                readOnly
                value={createdKey}
              />
              <Button
                onClick={() => copy(createdKey)}
                type="button"
                variant="outline"
              >
                <Copy />
                {t('apiKeys.copy')}
              </Button>
            </div>
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              {t('apiKeys.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('apiKeys.createTitle')}</DialogTitle>
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
          <form.Field name="expiresIn">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('apiKeys.expiryLabel')}
                </FieldLabel>
                <Select
                  items={expiryItems}
                  onValueChange={(value) =>
                    field.handleChange(value ?? 'never')
                  }
                  value={field.state.value}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
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
              {createApiKey.isPending
                ? t('apiKeys.creating')
                : t('apiKeys.createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
