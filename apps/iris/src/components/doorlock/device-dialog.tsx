import { useForm } from '@tanstack/react-form';
import { RotateCw, Save } from 'lucide-react';
import { useEffect } from 'react';
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
import { deviceSchema } from '@/utils/form-schemas';
import type {
  DeviceDialogProps,
  DeviceFormValues,
  DeviceLike,
} from './doorlock.types';

const initialState = (device?: DeviceLike | null): DeviceFormValues => ({
  apiToken: device?.apiToken ?? crypto.randomUUID(),
  lastResetReason: device?.lastResetReason ?? null,
  location: device?.location ?? null,
  name: device?.name ?? '',
});

export function DeviceDialog<TDevice extends DeviceLike = DeviceLike>({
  device,
  onOpenChange,
  onSubmit,
  open,
}: DeviceDialogProps<TDevice>) {
  const form = useForm({
    defaultValues: initialState(device),
    onSubmit: async ({ value }) => {
      await onSubmit({
        ...value,
        lastResetReason: value.lastResetReason?.trim() || null,
        location: value.location?.trim() || null,
        name: value.name.trim(),
      });
    },
    validators: { onSubmit: deviceSchema },
  });

  useEffect(() => {
    form.reset(initialState(device));
  }, [device, form.reset]);

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
              {device ? 'Save changes' : 'Create device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
