import { RotateCw, Save } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DeviceFormState = {
  apiToken: string;
  lastResetReason?: string | null;
  location?: string | null;
  name: string;
};

type DeviceLike = {
  apiToken: string;
  lastResetReason?: string | null;
  location?: string | null;
  name: string;
};

type DeviceDialogProps<TDevice extends DeviceLike = DeviceLike> = {
  device?: TDevice | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DeviceFormState) => Promise<void>;
  open: boolean;
};

const initialState = (device?: DeviceLike | null): DeviceFormState => ({
  apiToken: device?.apiToken ?? crypto.randomUUID(),
  lastResetReason: device?.lastResetReason ?? null,
  location: device?.location ?? null,
  name: device?.name ?? '',
});

export function DeviceDialog<TDevice extends DeviceLike = DeviceLike>({
  device,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
}: DeviceDialogProps<TDevice>) {
  const [formState, setFormState] = useState<DeviceFormState>(
    initialState(device)
  );

  useEffect(() => {
    setFormState(initialState(device));
  }, [device]);

  const isValid = useMemo(
    () => formState.name.trim().length > 0,
    [formState.name]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      return;
    }
    await onSubmit({
      ...formState,
      lastResetReason: formState.lastResetReason?.trim() || null,
      location: formState.location?.trim() || null,
      name: formState.name.trim(),
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device ? 'Edit device' : 'Add device'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="device-name">Name</Label>
            <Input
              id="device-name"
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              required
              value={formState.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-location">Location</Label>
            <Input
              id="device-location"
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  location: event.target.value,
                }))
              }
              placeholder="Optional"
              value={formState.location ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-reset-reason">Last reset reason</Label>
            <Input
              id="device-reset-reason"
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  lastResetReason: event.target.value,
                }))
              }
              placeholder="Optional"
              value={formState.lastResetReason ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-api-token">API token</Label>
            <div className="flex gap-2">
              <Input
                id="device-api-token"
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    apiToken: event.target.value,
                  }))
                }
                required
                value={formState.apiToken}
              />
              <Button
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    apiToken: crypto.randomUUID(),
                  }))
                }
                size="icon"
                type="button"
                variant="outline"
              >
                <RotateCw className="size-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!isValid || isSubmitting} type="submit">
              <Save className="mr-2 h-4 w-4" />
              {device ? 'Save changes' : 'Create device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
