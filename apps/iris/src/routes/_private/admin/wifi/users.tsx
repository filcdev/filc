import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@filcdev/ui/components/collapsible';
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
  AlertTriangle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/util/permission-guard';
import { RelativeTime } from '@/components/util/relative-time';
import {
  WifiDeviceDialog,
  WifiUserDialog,
} from '@/components/wifi/wifi-dialogs';
import {
  defaultWifiFilterState,
  type WifiFilterState,
  WifiFilters,
} from '@/components/wifi/wifi-filters';
import {
  useDeleteWifiDevice,
  useDeleteWifiUser,
  useWifiDevices,
  useWifiSpeedProfiles,
  useWifiUsers,
  type WifiDevice,
  type WifiUser,
} from '@/hooks/wifi-admin';
import { confirmDestructiveAction } from '@/utils/confirm';

/** Devices idle longer than this are flagged. */
const STALE_DAYS = 45;

const PAGE_SIZE = 10_000;

/** A user row plus the devices the table groups under it. */
type WifiUserRow = WifiUser & {
  devices: WifiDevice[];
  filteredDevices: WifiDevice[];
  isOrphan: boolean;
};

const formatMac = (mac: string): string =>
  mac
    .replace(/[^0-9a-fA-F]/g, '')
    .match(/.{1,2}/g)
    ?.join(':')
    .toUpperCase() ?? mac;

const isStale = (value: Date | null): boolean =>
  value !== null && dayjs().diff(dayjs(value), 'day') > STALE_DAYS;

/** Whether one device survives the active filters. */
const deviceMatchesFilters = (
  device: WifiDevice,
  userBanned: boolean,
  filters: WifiFilterState,
  macCounts: Map<string, number>
): boolean => {
  if (filters.bannedOnly && !(device.banned || userBanned)) {
    return false;
  }
  if (filters.inactiveOnly && !isStale(device.lastActiveAt)) {
    return false;
  }
  if (
    filters.activeOnly &&
    (device.lastActiveAt === null || isStale(device.lastActiveAt))
  ) {
    return false;
  }
  if (
    filters.sharedMacsOnly &&
    (macCounts.get(device.macAddress.toLowerCase()) ?? 1) <= 1
  ) {
    return false;
  }
  return true;
};

/** Whether one account survives the filters that are not device-scoped. */
const userMatchesFilters = (
  user: WifiUserRow,
  filters: WifiFilterState,
  profileFilter: string | null
): boolean => {
  if (filters.minDevices > 0 && user.devices.length < filters.minDevices) {
    return false;
  }
  if (
    filters.speedProfileId !== null &&
    !user.isOrphan &&
    user.speedProfileId !== profileFilter
  ) {
    return false;
  }
  if (filters.manualOnly && !user.isOrphan && user.userId !== user.createdBy) {
    return false;
  }
  return true;
};

export const Route = createFileRoute('/_private/admin/wifi/users')({
  component: () => (
    <PermissionGuard permission={permissions.wifiRead}>
      <WifiUsersPage />
    </PermissionGuard>
  ),
});

function WifiUsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<WifiFilterState>(
    defaultWifiFilterState
  );

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WifiUser | undefined>();

  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<WifiDevice | undefined>();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>(
    {}
  );

  const usersQuery = useWifiUsers({ limit: PAGE_SIZE, offset: 0 });
  const devicesQuery = useWifiDevices({ limit: PAGE_SIZE, offset: 0 });
  const profilesQuery = useWifiSpeedProfiles();

  const deleteUser = useDeleteWifiUser();
  const deleteDevice = useDeleteWifiDevice();

  const users = usersQuery.data?.users ?? [];
  const allDevices = devicesQuery.data?.devices ?? [];
  const profiles = profilesQuery.data?.speedProfiles ?? [];

  const { combined, macCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const device of allDevices) {
      const mac = device.macAddress.toLowerCase();
      counts.set(mac, (counts.get(mac) ?? 0) + 1);
    }

    const devicesByUserId = new Map<string | null, WifiDevice[]>();
    for (const device of allDevices) {
      const owner = device.wifiUserId;
      const bucket = devicesByUserId.get(owner);
      if (bucket) {
        bucket.push(device);
      } else {
        devicesByUserId.set(owner, [device]);
      }
    }

    const rows: WifiUserRow[] = users.map((user) => ({
      ...user,
      devices: devicesByUserId.get(user.id) ?? [],
      filteredDevices: [],
      isOrphan: false,
    }));

    const orphans = devicesByUserId.get(null) ?? [];
    if (orphans.length > 0) {
      const lastActiveAt = orphans.reduce<Date | null>(
        (latest, device) =>
          device.lastActiveAt &&
          (!latest || dayjs(device.lastActiveAt).isAfter(latest))
            ? device.lastActiveAt
            : latest,
        null
      );
      rows.push({
        allowedMacAddresses: null,
        banned: false,
        comment: t('wifiAdminUsers.orphanDevicesDescription'),
        createdAt: new Date(),
        createdBy: null,
        creatorName: null,
        devices: orphans,
        filteredDevices: [],
        id: 'orphan',
        isOrphan: true,
        lastActiveAt,
        speedProfileId: null,
        updatedAt: new Date(),
        userId: null,
        username: t('wifiAdminUsers.orphanDevices'),
      });
    }

    return { combined: rows, macCounts: counts };
  }, [allDevices, users, t]);

  const filteredData = useMemo(() => {
    const needle = search.toLowerCase();
    const profileFilter =
      filters.speedProfileId === 'none' ? null : filters.speedProfileId;
    const deviceFiltersActive =
      filters.inactiveOnly ||
      filters.activeOnly ||
      filters.sharedMacsOnly ||
      filters.bannedOnly;

    const matchesSearch = (user: WifiUserRow) =>
      !needle ||
      user.username.toLowerCase().includes(needle) ||
      (user.comment?.toLowerCase() ?? '').includes(needle);

    const deviceMatchesSearch = (device: WifiDevice) =>
      !needle ||
      device.macAddress.toLowerCase().includes(needle) ||
      (device.nickname?.toLowerCase() ?? '').includes(needle);

    return combined
      .map((user) => {
        const userMatchesSearch = matchesSearch(user);
        const filteredDevices = user.devices.filter(
          (device) =>
            (userMatchesSearch || deviceMatchesSearch(device)) &&
            deviceMatchesFilters(device, user.banned, filters, macCounts)
        );

        const keepUser =
          (!needle || userMatchesSearch || filteredDevices.length > 0) &&
          (!deviceFiltersActive || filteredDevices.length > 0) &&
          userMatchesFilters(user, filters, profileFilter);

        return { ...user, filteredDevices, keepUser };
      })
      .filter(
        (user) =>
          user.keepUser &&
          (user.filteredDevices.length > 0 ||
            !needle ||
            user.username.toLowerCase().includes(needle))
      );
  }, [combined, search, filters, macCounts]);

  const isLoading = usersQuery.isFetching || devicesQuery.isFetching;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('wifiAdminUsers.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('wifiAdminUsers.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={isLoading}
            onClick={() => {
              usersQuery.refetch();
              devicesQuery.refetch();
            }}
            size="icon"
            variant="outline"
          >
            <RefreshCw
              className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingUser(undefined);
              setUserDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminUsers.addUser')}
            </span>
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setTargetUserId(null);
              setEditingDevice(undefined);
              setDeviceDialogOpen(true);
            }}
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminUsers.addDevice')}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('wifiAdminUsers.searchPlaceholder')}
            value={search}
          />
        </div>
        <WifiFilters filters={filters} onChange={setFilters} />
      </div>

      <div className="rounded-md border bg-card">
        {filteredData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {isLoading ? t('common.loading') : t('wifiAdminUsers.noUsersFound')}
          </div>
        ) : (
          <div className="flex w-full flex-col">
            {filteredData.map((user) => (
              <Collapsible
                className="border-b px-4 py-2 last:border-b-0"
                key={user.id}
                open={Boolean(expandedUsers[user.id])}
              >
                <CollapsibleTrigger
                  className="flex w-full cursor-pointer items-center justify-between py-2 hover:no-underline"
                  onClick={() =>
                    setExpandedUsers((previous) => ({
                      ...previous,
                      [user.id]: !previous[user.id],
                    }))
                  }
                >
                  <div className="flex w-full items-center justify-between pr-4">
                    <div className="flex items-center gap-4 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{user.username}</span>
                        {user.banned && (
                          <Badge variant="destructive">
                            {t('wifiAdminUsers.banned')}
                          </Badge>
                        )}
                        {isStale(user.lastActiveAt) && !user.isOrphan && (
                          <Badge
                            className="border-amber-500 text-amber-500"
                            variant="outline"
                          >
                            {t('wifiAdminUsers.inactiveWarning')}
                          </Badge>
                        )}
                        {!user.isOrphan && user.createdBy === null && (
                          <Badge
                            className="border-destructive/50 font-normal text-destructive"
                            variant="secondary"
                          >
                            {t('wifiAdminUsers.createdByDeletedAdmin')}
                          </Badge>
                        )}
                        {!user.isOrphan &&
                          user.createdBy !== null &&
                          user.userId !== user.createdBy && (
                            <Badge className="font-normal" variant="secondary">
                              {t('wifiAdminUsers.createdByHint', {
                                name: user.creatorName ?? 'Admin',
                              })}
                            </Badge>
                          )}
                      </div>
                      <div className="hidden text-muted-foreground text-sm md:flex">
                        {user.comment && (
                          <span className="max-w-[200px] truncate">
                            {user.comment}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 font-normal text-sm">
                      {!user.isOrphan && user.speedProfileId && (
                        <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
                          <Badge
                            className="h-5 px-1.5 text-[10px]"
                            variant="secondary"
                          >
                            {profiles.find(
                              (profile) => profile.id === user.speedProfileId
                            )?.name ?? user.speedProfileId}
                          </Badge>
                        </div>
                      )}
                      {!user.isOrphan && (
                        <div className="hidden text-muted-foreground sm:flex">
                          {user.filteredDevices.length}{' '}
                          {t('wifiAdminUsers.devices')}
                        </div>
                      )}
                      {!user.isOrphan && (
                        <div className="hidden w-[140px] text-right min-[460px]:block">
                          <RelativeTime date={user.lastActiveAt} />
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-4 py-2">
                    {!user.isOrphan && (
                      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-4 text-muted-foreground text-sm">
                          {user.speedProfileId && (
                            <span>
                              {t('wifiAdminUsers.speedProfile')}:{' '}
                              <Badge variant="secondary">
                                {user.speedProfileId}
                              </Badge>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => {
                              setEditingUser(user);
                              setUserDialogOpen(true);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('wifiAdminUsers.editUser')}
                          </Button>
                          <Button
                            onClick={() => {
                              setTargetUserId(user.id);
                              setEditingDevice(undefined);
                              setDeviceDialogOpen(true);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('wifiAdminUsers.addDevice')}
                          </Button>
                          <Button
                            onClick={() => {
                              if (
                                confirmDestructiveAction(
                                  t('wifiAdminUsers.deleteUserWarning')
                                )
                              ) {
                                deleteUser.mutate({ id: user.id });
                              }
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {user.filteredDevices.length > 0 ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {t('wifiAdminUsers.deviceMac')}
                              </TableHead>
                              <TableHead>
                                {t('wifiAdminUsers.deviceNickname')}
                              </TableHead>
                              <TableHead>
                                {t('wifiAdminUsers.lastActive')}
                              </TableHead>
                              <TableHead>
                                {t('wifiAdminUsers.status')}
                              </TableHead>
                              <TableHead className="w-[100px] text-right">
                                {t('wifiAdminUsers.actions')}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {user.filteredDevices.map((device) => {
                              const macCount =
                                macCounts.get(
                                  device.macAddress.toLowerCase()
                                ) ?? 1;

                              return (
                                <TableRow key={device.id}>
                                  <TableCell className="font-mono uppercase">
                                    {formatMac(device.macAddress)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-medium">
                                          {device.nickname ?? '-'}
                                        </span>
                                        {device.reportedHostname && (
                                          <span
                                            className="text-muted-foreground text-xs"
                                            title={t(
                                              'wifiAdminUsers.reportedHostname'
                                            )}
                                          >
                                            ({device.reportedHostname})
                                          </span>
                                        )}
                                      </div>
                                      {device.adminNotes && (
                                        <span className="max-w-[150px] truncate text-muted-foreground text-xs">
                                          {device.adminNotes}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <RelativeTime date={device.lastActiveAt} />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col items-start gap-1">
                                      {device.banned && (
                                        <Badge
                                          className="h-4 py-1 text-[10px] leading-none"
                                          variant="destructive"
                                        >
                                          <ShieldAlert className="mr-1 h-3 w-3" />
                                          {t('wifiAdminUsers.banned')}
                                        </Badge>
                                      )}
                                      {macCount > 1 && (
                                        <Badge
                                          className="h-4 border-amber-500 py-1 text-[10px] text-amber-500 leading-none"
                                          title={t(
                                            'wifiAdminUsers.macUsedMultipleTimes'
                                          )}
                                          variant="outline"
                                        >
                                          <AlertTriangle className="mr-1 h-3 w-3" />
                                          {macCount}x
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        onClick={() => {
                                          setEditingDevice(device);
                                          setDeviceDialogOpen(true);
                                        }}
                                        size="icon"
                                        variant="ghost"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        className="text-destructive"
                                        onClick={() => {
                                          if (
                                            confirmDestructiveAction(
                                              t(
                                                'wifiAdminUsers.deleteDeviceWarning'
                                              )
                                            )
                                          ) {
                                            deleteDevice.mutate({
                                              id: device.id,
                                            });
                                          }
                                        }}
                                        size="icon"
                                        variant="ghost"
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        {t('wifiAdminUsers.noDevicesFound')}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      <WifiUserDialog
        onOpenChange={setUserDialogOpen}
        open={userDialogOpen}
        user={editingUser}
      />
      <WifiDeviceDialog
        device={editingDevice}
        onOpenChange={setDeviceDialogOpen}
        open={deviceDialogOpen}
        wifiUserId={targetUserId}
      />
    </div>
  );
}
