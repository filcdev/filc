import { Download, Save } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateDeviceFirmware } from '@/hooks/doorlock-admin';

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
  const [url, setUrl] = useState('');

  const { isPending, mutateAsync } = useUpdateDeviceFirmware({
    onSaved: () => {
      setUrl('');
      onOpenChange(false);
    },
  });

  const isValid = url.trim().length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      return;
    }
    await mutateAsync({ ...(deviceId && { deviceId }), url: url.trim() });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Download className="mr-2 inline-block h-5 w-5" />
            {deviceName ? `Update "${deviceName}"` : 'Update all devices'}
          </DialogTitle>
          <DialogDescription>
            {deviceName
              ? `Push an OTA firmware update to ${deviceName}. The device will download and install the firmware from the provided URL automatically.`
              : 'Push an OTA firmware update to all registered devices. Each connected device will download and install the firmware from the provided URL.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ota-url">Firmware URL</Label>
            <Input
              id="ota-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/.../firmware.bin"
              type="url"
              value={url}
            />
          </div>
          <DialogFooter>
            <Button disabled={!isValid || isPending} type="submit">
              <Save />
              {deviceName ? 'Update device' : 'Update all devices'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
