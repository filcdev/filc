import { Save } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CardFormValues = {
  authorizedDeviceIds: string[];
  cardData: string;
  enabled: boolean;
  frozen: boolean;
  name: string;
  userId: string;
};

type DeviceOption = { id: string; name: string };
type UserOption = {
  email: string | null;
  id: string;
  name: string | null;
  nickname?: string | null;
};
type CardLike = {
  authorizedDevices: DeviceOption[];
  enabled: boolean;
  frozen: boolean;
  id: string;
  name: string;
  userId: string;
};

type CardDialogProps<
  TCard extends CardLike = CardLike,
  TDevice extends DeviceOption = DeviceOption,
  TUser extends UserOption = UserOption,
> = {
  card?: TCard | null;
  devices: TDevice[];
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CardFormValues) => Promise<void>;
  open: boolean;
  users: TUser[];
};

const initialState = (card?: CardLike | null): CardFormValues => ({
  authorizedDeviceIds: card?.authorizedDevices.map((device) => device.id) ?? [],
  cardData: '',
  enabled: card?.enabled ?? true,
  frozen: card?.frozen ?? false,
  name: card?.name ?? '',
  userId: card?.userId ?? '',
});

export function CardDialog<
  TCard extends CardLike = CardLike,
  TDevice extends DeviceOption = DeviceOption,
  TUser extends UserOption = UserOption,
>({
  card,
  devices,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  users,
}: CardDialogProps<TCard, TDevice, TUser>) {
  const [formState, setFormState] = useState<CardFormValues>(
    initialState(card)
  );

  useEffect(() => {
    setFormState(initialState(card));
  }, [card]);

  const isCreate = !card;

  const isValid = useMemo(() => {
    if (!formState.name.trim()) {
      return false;
    }
    if (!formState.userId) {
      return false;
    }
    if (isCreate && !formState.cardData?.trim()) {
      return false;
    }
    return true;
  }, [formState.cardData, formState.name, formState.userId, isCreate]);

  const toggleDevice = (deviceId: string, checked: boolean) => {
    setFormState((prev) => {
      if (checked) {
        return {
          ...prev,
          authorizedDeviceIds: Array.from(
            new Set([...prev.authorizedDeviceIds, deviceId])
          ),
        };
      }
      return {
        ...prev,
        authorizedDeviceIds: prev.authorizedDeviceIds.filter(
          (id) => id !== deviceId
        ),
      };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      return;
    }
    await onSubmit({
      ...formState,
      cardData: formState.cardData?.trim(),
      name: formState.name.trim(),
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{card ? 'Edit card' : 'Add card'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="card-name">Name</Label>
            <Input
              id="card-name"
              onValueChange={(name) =>
                setFormState((prev) => ({ ...prev, name }))
              }
              required
              value={formState.name}
            />
          </div>
          {isCreate && (
            <div className="space-y-2">
              <Label htmlFor="card-data">Card UID</Label>
              <Input
                id="card-data"
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    cardData: event.target.value,
                  }))
                }
                required
                value={formState.cardData ?? ''}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Owner</Label>
            <Select
              items={users.map((user) => ({
                label: user.nickname ?? user.name ?? user.email ?? 'Unknown',
                value: user.id,
              }))}
              onValueChange={(value) =>
                setFormState((prev) => ({ ...prev, userId: value ?? '' }))
              }
              value={formState.userId}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nickname ?? user.name ?? user.email ?? 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="card-enabled"
            >
              <Checkbox
                checked={formState.enabled}
                id="card-enabled"
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    enabled: Boolean(checked),
                  }))
                }
              />
              Enabled
            </label>
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="card-frozen"
            >
              <Checkbox
                checked={formState.frozen}
                id="card-frozen"
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    frozen: Boolean(checked),
                  }))
                }
              />
              Frozen
            </label>
          </div>
          <div className="space-y-2">
            <Label>Authorized devices</Label>
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
                      checked={formState.authorizedDeviceIds.includes(
                        device.id
                      )}
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
          </div>
          <DialogFooter>
            <Button disabled={!isValid || isSubmitting} type="submit">
              <Save className="mr-2 h-4 w-4" />
              {card ? 'Save changes' : 'Create card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
