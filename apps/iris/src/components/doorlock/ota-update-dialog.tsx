import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm, useStore } from '@tanstack/react-form';
import { Download, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUpdateDeviceFirmware } from '@/hooks/doorlock-admin';
import { otaUpdateSchema } from '@/utils/form-schemas';

type OtaUpdateDialogProps = {
  deviceId?: string | null;
  deviceName?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function OtaUpdateDialog({
  deviceId,
  deviceName,
  onOpenChange,
  open,
}: OtaUpdateDialogProps) {
  const { t } = useTranslation();

  const { isPending, mutateAsync } = useUpdateDeviceFirmware({
    onSaved: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const form = useForm({
    defaultValues: { url: '' },
    onSubmit: async ({ value }) => {
      await mutateAsync({
        ...(deviceId && { deviceId }),
        url: value.url.trim(),
      });
    },
    validators: {
      onChange: otaUpdateSchema,
      onSubmit: otaUpdateSchema,
    },
  });
  const isValid = useStore(form.store, (state) => state.isValid);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Download className="mr-2 inline-block h-5 w-5" />
            {deviceName
              ? t('doorlock.ota.titleDevice', { name: deviceName })
              : t('doorlock.ota.titleAll')}
          </DialogTitle>
          <DialogDescription>
            {deviceName
              ? t('doorlock.ota.descriptionDevice', { name: deviceName })
              : t('doorlock.ota.descriptionAll')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="url">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('doorlock.ota.urlLabel')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://github.com/.../firmware.bin"
                  type="url"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <Button disabled={!isValid || isPending} type="submit">
              <Save />
              {deviceName
                ? t('doorlock.ota.submitDevice')
                : t('doorlock.ota.submitAll')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
