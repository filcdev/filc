import type { WifiDevice, WifiUser } from '@filcdev/api/domains/wifi/admin';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@filcdev/ui/components/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
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
import { differenceInDays } from 'date-fns';
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
import { RelativeTime } from '@/components/wifi/relative-time';
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
} from '@/hooks/wifi-admin';

export const Route = createFileRoute('/_private/admin/wifi/users')({
  component: WifiUsersPage,
});

function WifiUsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<WifiFilterState>(
    defaultWifiFilterState
  );

  const [isUserOpen, setIsUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WifiUser | undefined>();

  const [isDeviceOpen, setIsDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<WifiDevice | undefined>();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>(
    {}
  );

  const [userToDelete, setUserToDelete] = useState<WifiUser | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<WifiDevice | null>(null);

  const usersQuery = useWifiUsers({ limit: 10_000, offset: 0 });
  const devicesQuery = useWifiDevices({ limit: 10_000, offset: 0 });
  const profilesQuery = useWifiSpeedProfiles();
  const profiles = profilesQuery.data ?? [];

  const deleteUserMutation = useDeleteWifiUser();
  const deleteDeviceMutation = useDeleteWifiDevice();

  const handleEditUser = (user: WifiUser) => {
    setEditingUser(user);
    setIsUserOpen(true);
  };

  const handleCreateUser = () => {
    setEditingUser(undefined);
    setIsUserOpen(true);
  };

  const handleDeleteUser = (user: WifiUser) => {
    setUserToDelete(user);
  };

  const handleEditDevice = (device: WifiDevice) => {
    setEditingDevice(device);
    setIsDeviceOpen(true);
  };

  const handleCreateDevice = (userId: string | null) => {
    setTargetUserId(userId);
    setEditingDevice(undefined);
    setIsDeviceOpen(true);
  };

  const handleDeleteDevice = (device: WifiDevice) => {
    setDeviceToDelete(device);
  };

  const users = usersQuery.data ?? [];
  const allDevices = devicesQuery.data ?? [];

  const { combined, macCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of allDevices) {
      const mac = d.macAddress.toLowerCase();
      counts.set(mac, (counts.get(mac) ?? 0) + 1);
    }

    const devicesByUserId = new Map<string | null, WifiDevice[]>();
    for (const d of allDevices) {
      const uid = d.wifiUserId;
      if (!devicesByUserId.has(uid)) {
        devicesByUserId.set(uid, []);
      }
      devicesByUserId.get(uid)?.push(d);
    }

    const result = users.map((u) => {
      const userDevices = devicesByUserId.get(u.id) ?? [];
      const lastActiveAt = userDevices.reduce<string | null>((latest, d) => {
        if (!d.lastActiveAt) {
          return latest;
        }
        if (!latest) {
          return d.lastActiveAt;
        }
        return new Date(d.lastActiveAt) > new Date(latest)
          ? d.lastActiveAt
          : latest;
      }, null);

      return {
        ...u,
        devices: userDevices,
        isOrphan: false,
        lastActiveAt,
      };
    });

    const orphans = devicesByUserId.get(null) ?? [];
    if (orphans.length > 0) {
      result.push({
        allowedMacAddresses: null,
        banned: false,
        comment: t(
          'wifiAdminUsers.orphanDevicesDescription',
          'Devices not linked to any specific user.'
        ),
        createdAt: new Date().toISOString(),
        createdBy: null,
        devices: orphans,
        id: 'orphan',
        isOrphan: true,
        lastActiveAt: null,
        speedProfileId: null,
        updatedAt: new Date().toISOString(),
        userId: null,
        username: t(
          'wifiAdminUsers.orphanDevices',
          'Orphan Devices & MAC Bans'
        ),
      });
    }

    return { combined: result, macCounts: counts };
  }, [allDevices, users, t]);

  const filteredData = useMemo(() => {
    const s = search.toLowerCase();

    return (
      combined
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy
        .map((user) => {
          let keepUser = true;

          const userMatchesSearch =
            !s ||
            user.username.toLowerCase().includes(s) ||
            (user.comment?.toLowerCase() || '').includes(s);

          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy
          const filteredDevices = user.devices.filter((d) => {
            if (
              s &&
              !userMatchesSearch &&
              !(
                d.macAddress.toLowerCase().includes(s) ||
                (d.nickname?.toLowerCase() || '').includes(s)
              )
            ) {
              return false;
            }

            if (filters.bannedOnly && !d.banned && !user.banned) {
              return false;
            }

            if (filters.inactiveOnly) {
              if (!d.lastActiveAt) {
                return false;
              }
              const diff = differenceInDays(
                new Date(),
                new Date(d.lastActiveAt)
              );
              if (diff <= 45) {
                return false;
              }
            }

            if (filters.activeOnly) {
              if (!d.lastActiveAt) {
                return false;
              }
              const diff = differenceInDays(
                new Date(),
                new Date(d.lastActiveAt)
              );
              if (diff > 45) {
                return false;
              }
            }

            if (filters.sharedMacsOnly) {
              const count = macCounts.get(d.macAddress.toLowerCase()) ?? 1;
              if (count <= 1) {
                return false;
              }
            }

            return true;
          });

          if (s && !userMatchesSearch && filteredDevices.length === 0) {
            keepUser = false;
          }

          if (
            filters.bannedOnly &&
            !user.banned &&
            filteredDevices.length === 0
          ) {
            keepUser = false;
          }

          if (
            (filters.inactiveOnly ||
              filters.activeOnly ||
              filters.sharedMacsOnly) &&
            filteredDevices.length === 0
          ) {
            keepUser = false;
          }

          if (
            filters.minDevices > 0 &&
            user.devices.length < filters.minDevices
          ) {
            keepUser = false;
          }

          if (
            filters.speedProfileId !== undefined &&
            filters.speedProfileId !== null &&
            user.speedProfileId !==
              (filters.speedProfileId === 'none'
                ? null
                : filters.speedProfileId) &&
            !user.isOrphan
          ) {
            keepUser = false;
          }

          if (
            filters.manualOnly &&
            !user.isOrphan &&
            user.userId === user.createdBy
          ) {
            keepUser = false;
          }

          return {
            ...user,
            filteredDevices,
            keepUser,
          };
        })
        .filter(
          (u) =>
            u.keepUser &&
            (u.filteredDevices.length > 0 ||
              !s ||
              u.username.toLowerCase().includes(s))
        )
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
          <Button className="gap-2" onClick={handleCreateUser}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminUsers.addUser')}
            </span>
          </Button>
          <Button
            className="gap-2"
            onClick={() => handleCreateDevice(null)}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('wifiAdminUsers.searchPlaceholder')}
            value={search}
          />
        </div>
        <WifiFilters filters={filters} onChange={setFilters} />
      </div>

      <div className="rounded-md border bg-card">
        {filteredData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : t(
                  'wifiAdminUsers.noUsersFound',
                  'No accounts or devices found.'
                )}
          </div>
        ) : (
          <div className="flex w-full flex-col">
            {filteredData.map((user) => {
              const isOrphan = user.isOrphan;

              const isUserInactive =
                user.lastActiveAt &&
                differenceInDays(new Date(), new Date(user.lastActiveAt)) > 45;

              return (
                <Collapsible
                  className="border-b px-4 py-2 last:border-b-0"
                  key={user.id}
                  open={!!expandedUsers[user.id]}
                >
                  <CollapsibleTrigger
                    className="flex w-full cursor-pointer items-center justify-between py-2 hover:no-underline"
                    onClick={() =>
                      setExpandedUsers((prev) => ({
                        ...prev,
                        [user.id]: !prev[user.id],
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
                              {t('wifiAdminUsers.banned', 'Banned')}
                            </Badge>
                          )}
                          {isUserInactive && !isOrphan && (
                            <Badge
                              className="border-amber-500 text-amber-500"
                              variant="outline"
                            >
                              {t('wifiAdminUsers.inactiveWarning', 'Inactive')}
                            </Badge>
                          )}
                          {!isOrphan && user.createdBy === null && (
                            <Badge
                              className="font-normal border-destructive/50 text-destructive"
                              variant="secondary"
                            >
                              {t(
                                'wifiAdminUsers.createdByDeletedAdmin',
                                'Created by: Deleted Admin'
                              )}
                            </Badge>
                          )}
                          {!isOrphan && user.createdBy !== null && user.userId !== user.createdBy && (
                            <Badge className="font-normal" variant="secondary">
                              {t(
                                'wifiAdminUsers.createdByHint',
                                'Created by: {{name}}',
                                {
                                  name: user.creatorName ?? 'Admin',
                                }
                              )}
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
                        {!isOrphan && user.speedProfileId && (
                          <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
                            <Badge
                              className="h-5 px-1.5 text-[10px]"
                              variant="secondary"
                            >
                              {profiles.find(
                                (p) => p.id === user.speedProfileId
                              )?.name ?? user.speedProfileId}
                            </Badge>
                          </div>
                        )}
                        {!isOrphan && (
                          <div className="hidden text-muted-foreground sm:flex">
                            {user.filteredDevices.length}{' '}
                            {t('wifiAdminUsers.devices', 'Devices')}
                          </div>
                        )}
                        {!isOrphan && (
                          <div className="hidden w-[140px] text-right min-[460px]:block">
                            <RelativeTime date={user.lastActiveAt} />
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-col gap-4 py-2">
                      {!isOrphan && (
                        <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex gap-4 text-muted-foreground text-sm">
                            {user.speedProfileId && (
                              <span>
                                {t(
                                  'wifiAdminUsers.speedProfile',
                                  'Speed Profile'
                                )}
                                :{' '}
                                <Badge variant="secondary">
                                  {user.speedProfileId}
                                </Badge>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => handleEditUser(user as WifiUser)}
                              size="sm"
                              variant="outline"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('wifiAdminUsers.editUser', 'Edit')}
                            </Button>
                            <Button
                              onClick={() => handleCreateDevice(user.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t('wifiAdminUsers.addDevice', 'Add Device')}
                            </Button>
                            <Button
                              onClick={() => handleDeleteUser(user as WifiUser)}
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
                                  {t('wifiAdminUsers.deviceMac', 'MAC Address')}
                                </TableHead>
                                <TableHead>
                                  {t(
                                    'wifiAdminUsers.deviceNickname',
                                    'Nickname'
                                  )}
                                </TableHead>
                                <TableHead>
                                  {t(
                                    'wifiAdminUsers.lastActive',
                                    'Last Active'
                                  )}
                                </TableHead>
                                <TableHead>
                                  {t('wifiAdminUsers.status', 'Status')}
                                </TableHead>
                                <TableHead className="w-[100px] text-right">
                                  {t('wifiAdminUsers.actions', 'Actions')}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {user.filteredDevices.map((d) => {
                                const macCount =
                                  macCounts.get(d.macAddress.toLowerCase()) ??
                                  1;
                                const isShared = macCount > 1;

                                return (
                                  <TableRow key={d.id}>
                                    <TableCell className="font-mono">
                                      <div className="flex items-center gap-2">
                                        <span className="uppercase">
                                          {d.macAddress
                                            .replace(/[^0-9a-fA-F]/g, '')
                                            .match(/.{1,2}/g)
                                            ?.join(':') ?? d.macAddress}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <div className="flex items-baseline gap-2">
                                          <span className="font-medium">
                                            {d.nickname ?? '-'}
                                          </span>
                                          {d.reportedHostname && (
                                            <span
                                              className="text-muted-foreground text-xs"
                                              title={t(
                                                'wifiAdminUsers.reportedHostname',
                                                'Reported Hostname'
                                              )}
                                            >
                                              ({d.reportedHostname})
                                            </span>
                                          )}
                                        </div>
                                        {d.adminNotes && (
                                          <span className="max-w-[150px] truncate text-muted-foreground text-xs">
                                            {d.adminNotes}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <RelativeTime date={d.lastActiveAt} />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col items-start gap-1">
                                        {d.banned && (
                                          <Badge
                                            className="h-4 py-1 text-[10px] leading-none"
                                            variant="destructive"
                                          >
                                            <ShieldAlert className="mr-1 h-3 w-3" />
                                            {t(
                                              'wifiAdminUsers.banned',
                                              'Banned'
                                            )}
                                          </Badge>
                                        )}
                                        {isShared && (
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
                                          onClick={() => handleEditDevice(d)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          className="text-destructive"
                                          onClick={() => handleDeleteDevice(d)}
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
                          {t(
                            'wifiAdminUsers.noDevicesFound',
                            'No devices found.'
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {isUserOpen && (
        <WifiUserDialog
          onOpenChange={setIsUserOpen}
          open={isUserOpen}
          user={editingUser}
        />
      )}

      {isDeviceOpen && (
        <WifiDeviceDialog
          device={editingDevice}
          onOpenChange={setIsDeviceOpen}
          open={isDeviceOpen}
          wifiUserId={targetUserId}
        />
      )}

      <Dialog
        onOpenChange={(open) => !open && setUserToDelete(null)}
        open={!!userToDelete}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('wifiAdminUsers.deleteConfirmTitle', 'Delete User')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'wifiAdminUsers.deleteUserWarning',
                'Are you sure you want to delete this user? Deleting a user does not equate to banning them, as they can simply reregister their account.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToDelete(null)} variant="outline">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={deleteUserMutation.isPending}
              onClick={() => {
                if (userToDelete) {
                  deleteUserMutation.mutate(userToDelete.id, {
                    onSuccess: () => setUserToDelete(null),
                  });
                }
              }}
              variant="destructive"
            >
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDeviceToDelete(null)}
        open={!!deviceToDelete}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('wifiAdminUsers.deleteDeviceConfirmTitle', 'Delete Device')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'wifiAdminUsers.deleteDeviceWarning',
                'Are you sure you want to delete this device? Deleting a device does not equate to banning it, as it can simply rejoin the network.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeviceToDelete(null)} variant="outline">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={deleteDeviceMutation.isPending}
              onClick={() => {
                if (deviceToDelete) {
                  deleteDeviceMutation.mutate(deviceToDelete.id, {
                    onSuccess: () => setDeviceToDelete(null),
                  });
                }
              }}
              variant="destructive"
            >
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
