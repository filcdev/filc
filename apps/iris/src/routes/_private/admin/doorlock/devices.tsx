import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  ChartArea,
  DoorOpen,
  Download,
  Key,
  Microchip,
  Pen,
  Plus,
  RefreshCw,
  Trash,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/admin/stat-card';
import { useConfirm } from '@/components/confirm-provider';
import { DeviceDialog } from '@/components/doorlock/device-dialog';
import { DeviceStatsDialog } from '@/components/doorlock/device-stats-dialog';
import { OtaUpdateDialog } from '@/components/doorlock/ota-update-dialog';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type DoorlockDevice,
  useDeleteDoorlockDevice,
  useDoorlockDevices,
} from '@/hooks/doorlock-admin';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type UseSortableResult, useSortable } from '@/hooks/use-sortable';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/doorlock/devices')({
  component: () => (
    <PermissionGuard permission={permissions.doorlockDevicesRead}>
      <DevicesPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.doorlock.devices.list.queryOptions()),
});

type DeviceSortColumn = 'name' | 'location' | 'apiToken' | 'updated';

function DevicesPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DoorlockDevice | null>(
    null
  );
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDevice, setStatsDevice] = useState<DoorlockDevice | null>(null);
  const [otaDialogOpen, setOtaDialogOpen] = useState(false);
  const [otaDevice, setOtaDevice] = useState<DoorlockDevice | null>(null);

  const hasWritePermission = useHasPermission(
    permissions.doorlockDevicesWrite,
    session?.user?.permissions
  );

  const devicesQuery = useDoorlockDevices();
  const devices: DoorlockDevice[] | undefined = devicesQuery.data?.items;

  const deleteMutation = useDeleteDoorlockDevice();

  const matchingDevices = useMemo(() => {
    const items = devices ?? [];
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
  }, [devices, search]);

  const sort = useSortable(matchingDevices, { getValue: getDeviceSortValue });
  const filteredDevices = sort.rows;

  const totalDevices = devices?.length ?? 0;
  const activeDevices = useMemo(() => {
    if (!devices) {
      return 0;
    }
    return devices.filter((device) => {
      const hoursSinceUpdate = dayjs().diff(dayjs(device.updatedAt), 'hour');
      return hoursSinceUpdate < 24;
    }).length;
  }, [devices]);
  const handleDelete = async (device: DoorlockDevice) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = await confirm({
      title: t('doorlockDevices.deleteConfirm', { name: device.name }),
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync({ id: device.id });
  };

  const hasError = devicesQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('doorlockDevices.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('doorlockDevices.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('doorlockDevices.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => devicesQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('doorlockDevices.refresh')}
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
                <Download className="h-4 w-4" />
                {t('doorlockDevices.updateAll')}
              </Button>
              <Button
                onClick={() => {
                  setSelectedDevice(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('doorlockDevices.addDevice')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Microchip className="text-primary" />}
          label={t('doorlockDevices.totalDevices')}
          value={totalDevices}
        />
        <StatCard
          icon={<DoorOpen className="text-primary" />}
          label={t('doorlockDevices.activeDevices')}
          value={activeDevices}
        />
        <StatCard
          icon={<Key className="text-primary" />}
          label={t('doorlockDevices.apiTokens')}
          value={totalDevices}
        />
      </div>

      <QueryBoundary data={devicesQuery.data} query={devicesQuery}>
        {() => (
          <DevicesTable
            deletePending={deleteMutation.isPending}
            devices={filteredDevices}
            hasError={hasError}
            hasWritePermission={hasWritePermission}
            onDelete={handleDelete}
            onEdit={(device) => {
              setSelectedDevice(device);
              setDialogOpen(true);
            }}
            onOta={(device) => {
              setOtaDevice(device);
              setOtaDialogOpen(true);
            }}
            onStats={(device) => {
              setStatsDevice(device);
              setStatsDialogOpen(true);
            }}
            sort={sort}
          />
        )}
      </QueryBoundary>

      <DeviceDialog<DoorlockDevice>
        device={selectedDevice}
        key={`${dialogOpen ? 'open' : 'closed'}:${selectedDevice?.id ?? 'new'}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedDevice(null);
          }
        }}
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
        deviceId={otaDevice?.id ?? null}
        deviceName={otaDevice?.name}
        onOpenChange={(open) => {
          setOtaDialogOpen(open);
          if (!open) {
            setOtaDevice(null);
          }
        }}
        open={otaDialogOpen}
      />
    </div>
  );
}

const DevicesTable = ({
  deletePending,
  devices,
  hasError,
  hasWritePermission,
  onDelete,
  onEdit,
  onOta,
  onStats,
  sort,
}: {
  deletePending: boolean;
  devices: DoorlockDevice[];
  hasError: boolean;
  hasWritePermission: boolean;
  onDelete: (device: DoorlockDevice) => void;
  onEdit: (device: DoorlockDevice) => void;
  onOta: (device: DoorlockDevice) => void;
  onStats: (device: DoorlockDevice) => void;
  sort: UseSortableResult<DoorlockDevice, DeviceSortColumn>;
}) => {
  const { t } = useTranslation();
  const { ariaSort, direction, toggle } = sort;

  const header = (column: DeviceSortColumn, label: string) => (
    <TableHead aria-sort={ariaSort(column)} className="select-none">
      <button
        className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
        onClick={() => toggle(column)}
        type="button"
      >
        {label}
        <SortIcon
          column={column}
          currentColumn={column}
          direction={direction}
        />
      </button>
    </TableHead>
  );

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            {header('name', t('doorlockDevices.name'))}
            {header('location', t('doorlockDevices.location'))}
            {header('apiToken', t('doorlockDevices.apiToken'))}
            {header('updated', t('doorlockDevices.lastUpdated'))}
            {hasWritePermission && (
              <TableHead>{t('doorlockDevices.actions')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
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
                      aria-label={t('doorlockDevices.statsTitle', {
                        name: device.name,
                      })}
                      onClick={() => onStats(device)}
                      size="icon"
                      variant="outline"
                    >
                      <ChartArea className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={t('doorlock.ota.titleDevice', {
                        name: device.name,
                      })}
                      onClick={() => onOta(device)}
                      size="icon"
                      variant="outline"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={t('common.edit')}
                      onClick={() => onEdit(device)}
                      size="icon"
                      variant="outline"
                    >
                      <Pen className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={t('common.delete')}
                      disabled={deletePending}
                      onClick={() => onDelete(device)}
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
          {!(devices.length || hasError) && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={hasWritePermission ? 5 : 4}
              >
                {t('doorlockDevices.noDevicesFound')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

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
