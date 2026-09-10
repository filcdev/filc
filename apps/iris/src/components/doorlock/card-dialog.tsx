import { useForm, useStore } from '@tanstack/react-form';
import { Save } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getOwnerLabel } from '@/components/doorlock/doorlock.utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
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
  useUpsertCardFromLog,
  useUpsertDoorlockCard,
} from '@/hooks/doorlock-admin';
import { createCardSchema, updateCardSchema } from '@/utils/form-schemas';
import type {
  CardDialogProps,
  CardFormValues,
  CardLike,
  DeviceOption,
  UserOption,
} from './doorlock.types';

const initialState = (card?: CardLike | null): CardFormValues => ({
  authorizedDeviceIds: card?.authorizedDevices.map((device) => device.id) ?? [],
  cardData: card?.cardData ?? '',
  enabled: card?.enabled ?? true,
  frozen: card?.frozen ?? false,
  name: card?.name ?? '',
  userId: card?.userId ?? null,
});

export function CardDialog<
  TCard extends CardLike = CardLike,
  TDevice extends DeviceOption = DeviceOption,
  TUser extends UserOption = UserOption,
>({
  card,
  context,
  devices,
  onOpenChange,
  open,
  users,
}: CardDialogProps<TCard, TDevice, TUser>) {
  const isCreate = !card?.id;
  const { t } = useTranslation();

  const upsertCardMutation = useUpsertDoorlockCard({
    onSaved: () => onOpenChange(false),
  });
  const upsertFromLogMutation = useUpsertCardFromLog({
    onSaved: () => onOpenChange(false),
  });
  const form = useForm({
    defaultValues: initialState(card),
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        cardData: value.cardData.trim(),
        name: value.name.trim(),
      };
      if (context === 'logs') {
        await upsertFromLogMutation.mutateAsync({ payload });
      } else {
        await upsertCardMutation.mutateAsync({
          ...(card?.id && { id: card.id }),
          payload,
        });
      }
    },
    validators: {
      onSubmit: isCreate ? createCardSchema : updateCardSchema,
    },
  });

  useEffect(() => {
    form.reset(initialState(card));
  }, [card, form.reset]);

  const authorizedDeviceIds = useStore(
    form.store,
    (state) => state.values.authorizedDeviceIds
  );

  const toggleDevice = (deviceId: string, checked: boolean) => {
    const current = form.getFieldValue('authorizedDeviceIds');
    if (checked) {
      form.setFieldValue(
        'authorizedDeviceIds',
        Array.from(new Set([...current, deviceId]))
      );
    } else {
      form.setFieldValue(
        'authorizedDeviceIds',
        current.filter((id) => id !== deviceId)
      );
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add card' : 'Edit card'}</DialogTitle>
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
          {isCreate && (
            <form.Field name="cardData">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Card UID</FieldLabel>
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
          )}
          <form.Field name="userId">
            {(field) => (
              <Field>
                <FieldLabel>{t('doorlockCards.owner')}</FieldLabel>
                <Combobox
                  emptyMessage={t('doorlockCards.noUsersFound')}
                  onValueChange={(value) => field.handleChange(value || null)}
                  options={users.map((user) => ({
                    label: getOwnerLabel(user) || t('doorlock.unknownUser'),
                    value: user.id,
                  }))}
                  placeholder={t('doorlockCards.selectOwnerPlaceholder')}
                  searchPlaceholder={t('search')}
                  value={field.state.value ?? ''}
                />
              </Field>
            )}
          </form.Field>
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="enabled">
              {(field) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  htmlFor={field.name}
                >
                  <Checkbox
                    checked={field.state.value}
                    id={field.name}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                  Enabled
                </label>
              )}
            </form.Field>
            <form.Field name="frozen">
              {(field) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  htmlFor={field.name}
                >
                  <Checkbox
                    checked={field.state.value}
                    id={field.name}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                  Frozen
                </label>
              )}
            </form.Field>
          </div>
          <Field>
            <FieldLabel>Authorized devices</FieldLabel>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {devices.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No devices found.
                </p>
              )}
              {devices.map((device) => {
                const checkboxId = `card-device-${device.id}`;
                return (
                  <label
                    className="flex items-center gap-2 text-sm"
                    htmlFor={checkboxId}
                    key={device.id}
                  >
                    <Checkbox
                      checked={authorizedDeviceIds.includes(device.id)}
                      id={checkboxId}
                      onCheckedChange={(checked) =>
                        toggleDevice(device.id, Boolean(checked))
                      }
                    />
                    {device.name}
                  </label>
                );
              })}
            </div>
          </Field>
          <DialogFooter>
            <Button disabled={!form.state.canSubmit} type="submit">
              <Save />
              {isCreate ? 'Create card' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
