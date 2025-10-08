import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPen, FaPlus, FaSpinner, FaTrash } from 'react-icons/fa6';
import { toast } from 'sonner';
import { PermissionGuard } from '~/frontend/components/permission-guard';
import { Badge } from '~/frontend/components/ui/badge';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/frontend/components/ui/dialog';
import { Input } from '~/frontend/components/ui/input';
import { Label } from '~/frontend/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/frontend/components/ui/table';

export const Route = createFileRoute('/_private/admin/doors/devices')({
  component: RouteComponent,
});

const DEFAULT_TTL_SECONDS = 30;
const STATUS_REFETCH_INTERVAL = 10_000;

type Device = {
  id: string;
  name: string;
  location: string | null;
  lastSeenAt: Date | null;
  ttlSeconds: number;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeviceStatus = {
  id: string;
  online: boolean;
  lastSeenAt: Date | null;
  ttlSeconds: number;
};

type DeviceFormData = {
  id: string;
  name: string;
  location: string;
  ttlSeconds: number;
};

function RouteComponent() {
  return (
    <PermissionGuard permission="device:upsert">
      <DevicesPage />
    </PermissionGuard>
  );
}

function DevicesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Device | null>(null);

  // Fetch devices
  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await fetch('/api/doorlock/devices');
      if (!res.ok) {
        throw new Error('Failed to fetch devices');
      }
      const json = await res.json();
      return json.data as Device[];
    },
  });

  // Fetch statuses
  const { data: statusesData } = useQuery({
    queryKey: ['device-statuses'],
    queryFn: async () => {
      if (!devicesData) {
        return {};
      }
      const statuses: Record<string, DeviceStatus> = {};
      await Promise.all(
        devicesData.map(async (device) => {
          try {
            const res = await fetch(
              `/api/doorlock/devices/${device.id}/status`
            );
            if (res.ok) {
              const json = await res.json();
              statuses[device.id] = json.data;
            }
          } catch {
            // Silently fail
          }
        })
      );
      return statuses;
    },
    enabled: !!devicesData && devicesData.length > 0,
    refetchInterval: STATUS_REFETCH_INTERVAL,
  });

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      const res = await fetch(`/api/doorlock/devices/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          location: data.location || undefined,
          ttlSeconds: data.ttlSeconds,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save device');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        t('doorlock.saveSuccess', { item: t('doorlock.deviceName') })
      );
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setEditingDevice(null);
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast.error(
        t('doorlock.errorSaving', { item: t('doorlock.deviceName') })
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/doorlock/devices/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete device');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        t('doorlock.deleteSuccess', { item: t('doorlock.deviceName') })
      );
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error(
        t('doorlock.errorDeleting', { item: t('doorlock.deviceName') })
      );
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-4">
        <FaSpinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('doorlock.manageDevices')}
          </h1>
          <p className="text-muted-foreground">{t('doorlock.title')}</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <FaPlus className="mr-2 h-4 w-4" />
          {t('doorlock.addDevice')}
        </Button>
      </div>

      {!devicesData || devicesData.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              {t('doorlock.noDevicesFound')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('doorlock.manageDevices')}</CardTitle>
            <CardDescription>
              Manage door lock devices and their settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('doorlock.deviceId')}</TableHead>
                    <TableHead>{t('doorlock.deviceName')}</TableHead>
                    <TableHead>{t('doorlock.location')}</TableHead>
                    <TableHead>{t('doorlock.status')}</TableHead>
                    <TableHead>{t('doorlock.lastSeen')}</TableHead>
                    <TableHead className="text-right">
                      {t('doorlock.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devicesData.map((device) => {
                    const status = statusesData?.[device.id];
                    const isOnline = status?.online ?? false;
                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-sm">
                          {device.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {device.name}
                        </TableCell>
                        <TableCell>{device.location || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              isOnline
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-gray-400'
                            }
                            variant={isOnline ? 'default' : 'secondary'}
                          >
                            {isOnline
                              ? t('doorlock.online')
                              : t('doorlock.offline')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {status?.lastSeenAt
                            ? new Date(status.lastSeenAt).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => setEditingDevice(device)}
                              size="sm"
                              variant="outline"
                            >
                              <FaPen className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setDeleteConfirm(device)}
                              size="sm"
                              variant="destructive"
                            >
                              <FaTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <DeviceFormDialog
        device={editingDevice}
        isOpen={isAddDialogOpen || !!editingDevice}
        isSubmitting={upsertMutation.isPending}
        onClose={() => {
          setEditingDevice(null);
          setIsAddDialogOpen(false);
        }}
        onSubmit={(data) => upsertMutation.mutate(data)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        onOpenChange={() => setDeleteConfirm(null)}
        open={!!deleteConfirm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('doorlock.deleteDevice')}</DialogTitle>
            <DialogDescription>
              {t('doorlock.confirmDelete', { item: deleteConfirm?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteConfirm(null)}
              variant="outline"
            >
              {t('doorlock.cancel')}
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
              variant="destructive"
            >
              {deleteMutation.isPending ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  {t('doorlock.delete')}
                </>
              ) : (
                t('doorlock.delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type DeviceFormDialogProps = {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DeviceFormData) => void;
  isSubmitting: boolean;
};

function DeviceFormDialog({
  device,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: DeviceFormDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<DeviceFormData>({
    id: device?.id || '',
    name: device?.name || '',
    location: device?.location || '',
    ttlSeconds: device?.ttlSeconds || DEFAULT_TTL_SECONDS,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {device ? t('doorlock.editDevice') : t('doorlock.addDevice')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="id">{t('doorlock.deviceId')}</Label>
              <Input
                disabled={!!device}
                id="id"
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value })
                }
                placeholder="door-01"
                required
                value={formData.id}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t('doorlock.deviceName')}</Label>
              <Input
                id="name"
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Main Entrance"
                required
                value={formData.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t('doorlock.location')}</Label>
              <Input
                id="location"
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Building A, Floor 1"
                value={formData.location}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ttl">{t('doorlock.ttlSeconds')}</Label>
              <Input
                id="ttl"
                max={3600}
                min={10}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ttlSeconds: Number(e.target.value),
                  })
                }
                required
                type="number"
                value={formData.ttlSeconds}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {t('doorlock.cancel')}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  {t('doorlock.save')}
                </>
              ) : (
                t('doorlock.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
