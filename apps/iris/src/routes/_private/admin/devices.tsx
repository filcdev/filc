import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { type InferResponseType, parseResponse } from 'hono/client';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  FaDoorOpen,
  FaKey,
  FaMicrochip,
  FaPen,
  FaPlus,
  FaTrash,
} from 'react-icons/fa6';
import { toast } from 'sonner';
import { DeviceDialog } from '@/components/doorlock/device-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';

type DevicesResponse = InferResponseType<typeof api.doorlock.devices.$get>;
type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];

export const Route = createFileRoute('/_private/admin/devices')({
  component: () => (
    <PermissionGuard permission="doorlock:devices:read">
      <DevicesPage />
    </PermissionGuard>
  ),
});

type DevicePayload = {
  apiToken: string;
  lastResetReason?: string | null;
  location?: string | null;
  name: string;
};

function DevicesPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DoorlockDevice | null>(
    null
  );

  const hasWritePermission = useMemo(() => {
    const perms = session?.user?.permissions ?? [];
    return perms.includes('*') || perms.includes('doorlock:devices:write');
  }, [session?.user?.permissions]);

  const devicesQuery = useQuery({
    queryFn: async (): Promise<DoorlockDevice[]> => {
      const res = await parseResponse(api.doorlock.devices.$get());
      if (!(res.success && res.data?.devices)) {
        throw new Error('Failed to load devices');
      }
      return res.data.devices as DoorlockDevice[];
    },
    queryKey: ['doorlock', 'devices'],
  });

  const upsertMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: DevicePayload }) => {
      if (id) {
        return parseResponse(
          api.doorlock.devices[':id'].$put(
            {
              param: { id },
            },
            {
              init: { body: JSON.stringify(payload) },
            }
          )
        );
      }
      return parseResponse(api.doorlock.devices.$post({ json: payload }));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save device');
    },
    onSuccess: (_res, variables) => {
      toast.success(variables.id ? 'Device updated' : 'Device created');
      queryClient.invalidateQueries({ queryKey: ['doorlock', 'devices'] });
      setDialogOpen(false);
      setSelectedDevice(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(api.doorlock.devices[':id'].$delete({ param: { id } })),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete device');
    },
    onSuccess: () => {
      toast.success('Device deleted');
      queryClient.invalidateQueries({ queryKey: ['doorlock', 'devices'] });
    },
  });

  const filteredDevices = useMemo(() => {
    const items = devicesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return items;
    }
    return items.filter(
      (device) =>
        device.name.toLowerCase().includes(term) ||
        device.apiToken.toLowerCase().includes(term) ||
        (device.location ?? '').toLowerCase().includes(term)
    );
  }, [devicesQuery.data, search]);

  const totalDevices = devicesQuery.data?.length ?? 0;
  const activeDevices = useMemo(() => {
    if (!devicesQuery.data) {
      return 0;
    }
    return devicesQuery.data.filter((device) => {
      const hoursSinceUpdate = dayjs().diff(dayjs(device.updatedAt), 'hour');
      return hoursSinceUpdate < 24;
    }).length;
  }, [devicesQuery.data]);

  const handleSave = async (payload: DevicePayload) => {
    await upsertMutation.mutateAsync({
      ...(selectedDevice?.id && { id: selectedDevice.id }),
      payload,
    });
  };

  const handleDelete = async (device: DoorlockDevice) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = confirmDestructiveAction(
      `Delete device "${device.name}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(device.id);
  };

  const isLoading = devicesQuery.isLoading;
  const hasError = devicesQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search devices..."
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => devicesQuery.refetch()} variant="outline">
            Refresh
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedDevice(null);
                setDialogOpen(true);
              }}
            >
              <FaPlus className="mr-2 h-4 w-4" /> Add device
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<FaMicrochip className="text-primary" />}
          label="Total devices"
          value={totalDevices}
        />
        <StatCard
          icon={<FaDoorOpen className="text-primary" />}
          label="Active (last 24h)"
          value={activeDevices}
        />
        <StatCard
          icon={<FaKey className="text-primary" />}
          label="API tokens"
          value={totalDevices}
        />
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load devices</AlertTitle>
          <AlertDescription>
            {(devicesQuery.error as Error)?.message ??
              'Please try again later.'}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>API token</TableHead>
              <TableHead>Last updated</TableHead>
              {hasWritePermission && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.location ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">
                  {device.apiToken}
                </TableCell>
                <TableCell>
                  {dayjs(device.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                </TableCell>
                {hasWritePermission && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedDevice(device);
                          setDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <FaPen className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(device)}
                        size="icon"
                        variant="destructive"
                      >
                        <FaTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!(filteredDevices.length || hasError) && (
              <TableRow>
                <TableCell
                  className="text-muted-foreground"
                  colSpan={hasWritePermission ? 5 : 4}
                >
                  No devices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <DeviceDialog<DoorlockDevice>
        device={selectedDevice}
        isSubmitting={upsertMutation.isPending}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedDevice(null);
          }
        }}
        onSubmit={handleSave}
        open={dialogOpen}
      />
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl">{value}</div>
      </CardContent>
    </Card>
  );
}
