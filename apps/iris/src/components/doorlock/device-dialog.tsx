import { devicePayloadSchema } from '@filcdev/api/domains/doorlock/devices';
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
import { RotateCw, Save } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DeviceDialogProps,
  DeviceFormValues,
  DeviceLike,
} from '@/components/doorlock/doorlock.types';
import { useUpsertDoorlockDevice } from '@/hooks/doorlock-admin';

const initialState = (
  device: DeviceLike | null | undefined,
  draftToken: string
): DeviceFormValues => ({
  apiToken: device?.apiToken ?? draftToken,
  lastResetReason: device?.lastResetReason ?? null,
  location: device?.location ?? null,
  name: device?.name ?? '',
});

export function DeviceDialog<TDevice extends DeviceLike = DeviceLike>({
  device,
  onOpenChange,
  open,
}: DeviceDialogProps<TDevice>) {
  const { t } = useTranslation();
  const upsertMutation = useUpsertDoorlockDevice({
    onSaved: () => onOpenChange(false),
  });
  // One token per dialog mount: a fresh `crypto.randomUUID()` inside
  // `initialState` would change the form's values on every render.
  const [draftToken] = useState(() => crypto.randomUUID());

  const form = useForm({
    defaultValues: initialState(device, draftToken),
    onSubmit: async ({ value }) => {
      await upsertMutation.mutateAsync({
        ...(device?.id && { id: device.id }),
        payload: {
          ...value,
          lastResetReason: value.lastResetReason?.trim() || null,
          location: value.location?.trim() || null,
          name: value.name.trim(),
        },
      });
    },
    validators: { onSubmit: devicePayloadSchema },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device ? 'Edit device' : 'Add device'}</DialogTitle>
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
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="location">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Optional"
                  value={field.state.value ?? ''}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="lastResetReason">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Last reset reason</FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Optional"
                  value={field.state.value ?? ''}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="apiToken">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>API token</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                    value={field.state.value}
                  />
                  <Button
                    aria-label={t('doorlockDevices.generateApiToken')}
                    onClick={() => field.handleChange(crypto.randomUUID())}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <RotateCw className="size-4" />
                  </Button>
                </div>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <Button disabled={!form.state.canSubmit} type="submit">
              <Save />
              {device
                ? t('doorlockDevices.saveChanges')
                : t('doorlockDevices.createDevice')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
