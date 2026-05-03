import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import {
  ChartArea,
  DoorOpen,
  Download,
  Key,
  Microchip,
  Pen,
  Plus,
  Trash,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DeviceDialog } from '@/components/doorlock/device-dialog';
import { DeviceStatsDialog } from '@/components/doorlock/device-stats-dialog';
import { OtaUpdateDialog } from '@/components/doorlock/ota-update-dialog';
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
import { SortIcon } from '@/components/util/sort-icon';
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type DevicesResponse = InferResponseType<typeof api.doorlock.devices.$get>;
type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];

export const Route = createFileRoute('/_private/admin/doorlock/devices')({
  component: () => (
    <PermissionGuard permission="doorlock:devices:read">
      <DevicesPage />
    </PermissionGuard>
  ),
});

type DeviceSortColumn = 'name' | 'location' | 'apiToken' | 'updated';

function DevicesPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<DeviceSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DoorlockDevice | null>(
    null
  );
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDevice, setStatsDevice] = useState<DoorlockDevice | null>(null);
  const [otaDialogOpen, setOtaDialogOpen] = useState(false);
  const [otaDevice, setOtaDevice] = useState<DoorlockDevice | null>(null);

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
    queryKey: queryKeys.doorlock.devices(),
  });

  const $upsertDevice = api.doorlock.devices.$post;
  const upsertMutation = useMutation<
    InferResponseType<typeof $upsertDevice>,
    Error,
    { id?: string; payload: InferRequestType<typeof $upsertDevice>['json'] }
  >({
    mutationFn: ({ id, payload }) => {
      if (id) {
        return parseResponse(
          api.doorlock.devices[':id'].$put({
            json: payload,
            param: { id },
          })
        );
      }
      return parseResponse(api.doorlock.devices.$post({ json: payload }));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save device');
    },
    onSuccess: (_res, variables) => {
      toast.success(variables.id ? 'Device updated' : 'Device created');
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.devices() });
      setDialogOpen(false);
      setSelectedDevice(null);
    },
  });

  const $deleteDevice = api.doorlock.devices[':id'].$delete;
  const deleteMutation = useMutation<
    InferResponseType<typeof $deleteDevice>,
    Error,
    string
  >({
    mutationFn: async (id: string) =>
      parseResponse(api.doorlock.devices[':id'].$delete({ param: { id } })),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete device');
    },
    onSuccess: () => {
      toast.success('Device deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.devices() });
    },
  });

  const otaMutation = useMutation<
    unknown,
    Error,
    { deviceId?: string; url: string }
  >({
    mutationFn: ({ deviceId, url }) => {
      if (deviceId) {
        return parseResponse(
          api.doorlock.devices[':id'].update.$post({
            json: { url },
            param: { id: deviceId },
          })
        );
      }
      return parseResponse(
        api.doorlock.devices.update.$post({ json: { url } })
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to trigger OTA update');
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.deviceId
          ? 'OTA update triggered'
          : 'OTA update triggered on all devices'
      );
      setOtaDialogOpen(false);
      setOtaDevice(null);
    },
  });

  const filteredDevices = useMemo(() => {
    const items = devicesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    let filtered = items;

    if (term) {
      filtered = filtered.filter(
        (device) =>
          device.name.toLowerCase().includes(term) ||
          device.apiToken.toLowerCase().includes(term) ||
          (device.location ?? '').toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getDeviceSortValue(a, sortColumn);
        const bValue = getDeviceSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [devicesQuery.data, search, sortColumn, sortDirection]);

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

  const handleSave = async (
    payload: InferRequestType<typeof $upsertDevice>['json']
  ) => {
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

  const handleSort = (column: DeviceSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
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
            <>
              <Button
                onClick={() => {
                  setOtaDevice(null);
                  setOtaDialogOpen(true);
                }}
                variant="outline"
              >
                <Download /> Update all
              </Button>
              <Button
                onClick={() => {
                  setSelectedDevice(null);
                  setDialogOpen(true);
                }}
              >
                <Plus /> Add device
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Microchip className="text-primary" />}
          label="Total devices"
          value={totalDevices}
        />
        <StatCard
          icon={<DoorOpen className="text-primary" />}
          label="Active (last 24h)"
          value={activeDevices}
        />
        <StatCard
          icon={<Key className="text-primary" />}
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
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Name
                  <SortIcon
                    column="name"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center gap-2">
                  Location
                  <SortIcon
                    column="location"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('apiToken')}
              >
                <div className="flex items-center gap-2">
                  API token
                  <SortIcon
                    column="apiToken"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('updated')}
              >
                <div className="flex items-center gap-2">
                  Last updated
                  <SortIcon
                    column="updated"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                  />
                </div>
              </TableHead>
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
                          setStatsDevice(device);
                          setStatsDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <ChartArea className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setOtaDevice(device);
                          setOtaDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedDevice(device);
                          setDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <Pen className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(device)}
                        size="icon"
                        variant="destructive"
                      >
                        <Trash className="h-4 w-4" />
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

      <DeviceStatsDialog
        deviceId={statsDevice?.id ?? null}
        deviceName={statsDevice?.name ?? ''}
        onOpenChange={(open) => {
          setStatsDialogOpen(open);
          if (!open) {
            setStatsDevice(null);
          }
        }}
        open={statsDialogOpen}
      />

      <OtaUpdateDialog
        deviceName={otaDevice?.name}
        isSubmitting={otaMutation.isPending}
        onOpenChange={(open) => {
          setOtaDialogOpen(open);
          if (!open) {
            setOtaDevice(null);
          }
        }}
        onSubmit={async (url) => {
          await otaMutation.mutateAsync({
            ...(otaDevice?.id && { deviceId: otaDevice.id }),
            url,
          });
        }}
        open={otaDialogOpen}
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

function getDeviceSortValue(device: DoorlockDevice, column: DeviceSortColumn) {
  switch (column) {
    case 'name':
      return device.name;
    case 'location':
      return device.location ?? '';
    case 'apiToken':
      return device.apiToken;
    case 'updated':
      return new Date(device.updatedAt).getTime();
    default:
      return '';
  }
}
