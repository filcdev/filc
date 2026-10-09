import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/**
 * Query inputs are the procedures' *wire* input types, not the parsed output
 * types: `wifiAuthLogListQuerySchema.result` is `'true' | 'false'` on the wire
 * and a boolean after parsing, and the client takes the former.
 */
export type WifiListQuery = Parameters<typeof api.wifi.users.list>[0];
export type WifiDeviceListQuery = Parameters<typeof api.wifi.devices.list>[0];
export type WifiAuthLogListQuery = Parameters<typeof api.wifi.authLogs.list>[0];

type UsersData = Awaited<ReturnType<typeof api.wifi.users.list>>;
type DevicesData = Awaited<ReturnType<typeof api.wifi.devices.list>>;
type LogsData = Awaited<ReturnType<typeof api.wifi.authLogs.list>>;
type NasData = Awaited<ReturnType<typeof api.wifi.nas.list>>;
type SpeedProfilesData = Awaited<
  ReturnType<typeof api.wifi.speedProfiles.list>
>;
type RoleProfilesData = Awaited<
  ReturnType<typeof api.wifi.roleSpeedProfiles.list>
>;

export type WifiUser = UsersData['users'][number];
export type WifiDevice = DevicesData['devices'][number];
export type WifiAuthLog = LogsData['logs'][number];
export type WifiNas = NasData['nas'][number];
export type WifiSpeedProfile = SpeedProfilesData['speedProfiles'][number];
export type WifiRoleSpeedProfile =
  RoleProfilesData['roleSpeedProfiles'][number];
export type WifiStatsOverview = Awaited<
  ReturnType<typeof api.wifi.stats.overview>
>;

export type WifiUserPayload = Parameters<typeof api.wifi.users.create>[0];
export type WifiDevicePayload = Parameters<typeof api.wifi.devices.create>[0];
export type WifiNasPayload = Parameters<typeof api.wifi.nas.create>[0];
export type WifiSpeedProfilePayload = Parameters<
  typeof api.wifi.speedProfiles.create
>[0];
export type WifiRoleProfilePayload = Parameters<
  typeof api.wifi.roleSpeedProfiles.create
>[0];

/** Account, device, active-device and auth statistics. */
export function useWifiAdminStatsOverview() {
  return useQuery(orpc.wifi.stats.overview.queryOptions());
}

/** WiFi accounts, newest last. */
export function useWifiUsers(input: WifiListQuery) {
  return useQuery({ ...orpc.wifi.users.list.queryOptions({ input }) });
}

/** Devices, optionally filtered by owner; `wifiUserId: null` means unowned. */
export function useWifiDevices(input: WifiDeviceListQuery) {
  return useQuery({ ...orpc.wifi.devices.list.queryOptions({ input }) });
}

/** Every authorized NAS. */
export function useWifiNas() {
  return useQuery(orpc.wifi.nas.list.queryOptions());
}

/** Speed profiles mirrored from the UniFi controller. */
export function useWifiSpeedProfiles() {
  return useQuery(orpc.wifi.speedProfiles.list.queryOptions());
}

/** Role → speed-profile mappings. */
export function useWifiRoleProfiles() {
  return useQuery(orpc.wifi.roleSpeedProfiles.list.queryOptions());
}

/** Auth attempts, newest first. */
export function useWifiAuthLogs(input: WifiAuthLogListQuery) {
  return useQuery({ ...orpc.wifi.authLogs.list.queryOptions({ input }) });
}

/**
 * A user write changes the account *and* the devices the admin pages group
 * under it, so both lists are invalidated.
 */
const invalidateUsersAndDevices = (
  queryClient: ReturnType<typeof useQueryClient>
): void => {
  queryClient.invalidateQueries({ queryKey: orpc.wifi.users.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.wifi.devices.list.key() });
};

export function useCreateWifiUser({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.users.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.createError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.createSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useUpdateWifiUser({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.users.update.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.updateError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.updateSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useDeleteWifiUser({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.users.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.deleteError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.deleteSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useCreateWifiDevice({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.devices.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.createDeviceError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.createDeviceSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useUpdateWifiDevice({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.devices.update.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.updateDeviceError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.updateDeviceSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useDeleteWifiDevice({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.devices.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminUsers.deleteDeviceError'));
      },
      onSuccess: () => {
        invalidateUsersAndDevices(queryClient);
        toast.success(t('wifiAdminUsers.deleteDeviceSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useCreateWifiNas({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.nas.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminNas.createError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.wifi.nas.list.key() });
        toast.success(t('wifiAdminNas.createSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useUpdateWifiNas({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.nas.update.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminNas.updateError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.wifi.nas.list.key() });
        toast.success(t('wifiAdminNas.updateSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useDeleteWifiNas({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.nas.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminNas.deleteError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.wifi.nas.list.key() });
        toast.success(t('wifiAdminNas.deleteSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useCreateWifiSpeedProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.speedProfiles.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.createError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.speedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.createSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useUpdateWifiSpeedProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.speedProfiles.update.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.updateError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.speedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.updateSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useDeleteWifiSpeedProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.speedProfiles.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.deleteError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.speedProfiles.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.roleSpeedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.deleteSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useCreateWifiRoleProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.roleSpeedProfiles.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.createMappingError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.roleSpeedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.createMappingSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useUpdateWifiRoleProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.roleSpeedProfiles.update.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.updateMappingError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.roleSpeedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.updateMappingSuccess'));
        onSaved?.();
      },
    })
  );
}

export function useDeleteWifiRoleProfile({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.roleSpeedProfiles.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifiAdminProfiles.deleteMappingError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.wifi.roleSpeedProfiles.list.key(),
        });
        toast.success(t('wifiAdminProfiles.deleteMappingSuccess'));
        onSaved?.();
      },
    })
  );
}
