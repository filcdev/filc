import type {
  WifiDevice,
  WifiDeviceListQuery,
  WifiListQuery,
  WifiNas,
  WifiRoleSpeedProfile,
  WifiSpeedProfile,
  WifiUser,
} from '@filcdev/api/domains/wifi/admin';
import type { WifiStatsOverview } from '@filcdev/api/domains/wifi/stats';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

export function useWifiAdminStatsOverview() {
  return useApiQuery<WifiStatsOverview>(() => api.wifi.stats.overview.$get(), {
    queryKey: queryKeys.wifi.admin.stats(),
  });
}

export function useWifiUsers(query: WifiListQuery) {
  return useApiQuery<WifiUser[]>(
    () =>
      api.wifi.users.$get({
        query: {
          ...query,
          limit: query.limit?.toString(),
          offset: query.offset?.toString(),
        } as Record<string, unknown>,
      }),
    {
      queryKey: queryKeys.wifi.admin.users(query),
    }
  );
}

export function useWifiDevices(query: WifiDeviceListQuery) {
  return useApiQuery<WifiDevice[]>(
    () =>
      api.wifi.devices.$get({
        query: {
          ...query,
          limit: query.limit?.toString(),
          offset: query.offset?.toString(),
        } as Record<string, unknown>,
      }),
    {
      queryKey: queryKeys.wifi.admin.devices(query),
    }
  );
}

export function useWifiAuthLogs(
  query: import('@filcdev/api/domains/wifi/admin').WifiAuthLogListQuery
) {
  let resultStr: string | undefined;
  if (query.result !== undefined) {
    resultStr = query.result ? 'true' : 'false';
  }

  return useApiQuery<import('@filcdev/api/domains/wifi/admin').WifiAuthLog[]>(
    () =>
      api.wifi['auth-logs'].$get({
        query: {
          ...query,
          limit: query.limit?.toString(),
          offset: query.offset?.toString(),
          result: resultStr,
        } as Record<string, unknown>,
      }),
    {
      queryKey: queryKeys.wifi.admin.authLogs(query),
    }
  );
}

export function useWifiNas() {
  return useApiQuery<WifiNas[]>(() => api.wifi.nas.$get(), {
    queryKey: queryKeys.wifi.admin.nas(),
  });
}

export function useWifiSpeedProfiles() {
  return useApiQuery<WifiSpeedProfile[]>(
    () => api.wifi['speed-profiles'].$get(),
    {
      queryKey: queryKeys.wifi.admin.speedProfiles(),
    }
  );
}

export function useWifiRoleProfiles() {
  return useApiQuery<WifiRoleSpeedProfile[]>(
    () => api.wifi['role-speed-profiles'].$get(),
    {
      queryKey: queryKeys.wifi.admin.roleProfiles(),
    }
  );
}

export function useCreateWifiUser(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async (json: any) => {
      const res = await api.wifi.users.$post({ json });
      if (!res.ok) {
        throw new Error('Failed to create user');
      }
      return res.json();
    },
    onError: () =>
      toast.error(t('wifiAdminUsers.createError', 'Failed to create user')),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.createSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
      options?.onSaved?.();
    },
  });
}

export function useUpdateWifiUser(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async ({ id, json }: { id: string; json: any }) => {
      const res = await api.wifi.users[':id'].$put({ json, param: { id } });
      if (!res.ok) {
        throw new Error('Failed to update user');
      }
      return res.json();
    },
    onError: () =>
      toast.error(t('wifiAdminUsers.updateError', 'Failed to update user')),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.updateSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
      options?.onSaved?.();
    },
  });
}

export function useDeleteWifiUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.wifi.users[':id'].$delete({ param: { id } });
      if (!res.ok) {
        throw new Error('Failed to delete user');
      }
      return res.json();
    },
    onError: () => toast.error(t('wifiAdminUsers.deleteError')),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.deleteSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
    },
  });
}

export function useCreateWifiDevice(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async (json: any) => {
      const res = await api.wifi.devices.$post({ json });
      if (!res.ok) {
        throw new Error('Failed to create device');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminUsers.createDeviceError', 'Failed to create device')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.createDeviceSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.devices({}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
      options?.onSaved?.();
    },
  });
}

export function useUpdateWifiDevice(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async ({ id, json }: { id: string; json: any }) => {
      const res = await api.wifi.devices[':id'].$put({ json, param: { id } });
      if (!res.ok) {
        throw new Error('Failed to update device');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminUsers.updateDeviceError', 'Failed to update device')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.updateDeviceSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.devices({}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
      options?.onSaved?.();
    },
  });
}

export function useDeleteWifiDevice() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.wifi.devices[':id'].$delete({ param: { id } });
      if (!res.ok) {
        throw new Error('Failed to delete device');
      }
      return res.json();
    },
    onError: () => toast.error(t('wifiAdminUsers.deleteDeviceError')),
    onSuccess: () => {
      toast.success(t('wifiAdminUsers.deleteDeviceSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.devices({}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.users({}),
      });
    },
  });
}

export function useCreateWifiNas(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async (json: any) => {
      const res = await api.wifi.nas.$post({ json });
      if (!res.ok) {
        throw new Error('Failed to create NAS');
      }
      return res.json();
    },
    onError: () =>
      toast.error(t('wifiAdminNas.createError', 'Failed to create NAS')),
    onSuccess: () => {
      toast.success(t('wifiAdminNas.createSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.admin.nas() });
      options?.onSaved?.();
    },
  });
}

export function useUpdateWifiNas(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async ({ id, json }: { id: string; json: any }) => {
      const res = await api.wifi.nas[':id'].$put({ json, param: { id } });
      if (!res.ok) {
        throw new Error('Failed to update NAS');
      }
      return res.json();
    },
    onError: () =>
      toast.error(t('wifiAdminNas.updateError', 'Failed to update NAS')),
    onSuccess: () => {
      toast.success(t('wifiAdminNas.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.admin.nas() });
      options?.onSaved?.();
    },
  });
}

export function useDeleteWifiNas() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.wifi.nas[':id'].$delete({ param: { id } });
      if (!res.ok) {
        throw new Error('Failed to delete NAS');
      }
      return res.json();
    },
    onError: () => toast.error(t('wifiAdminNas.deleteError')),
    onSuccess: () => {
      toast.success(t('wifiAdminNas.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.admin.nas() });
    },
  });
}

export function useCreateWifiSpeedProfile(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async (json: any) => {
      const res = await api.wifi['speed-profiles'].$post({ json });
      if (!res.ok) {
        throw new Error('Failed to create speed profile');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminProfiles.createError', 'Failed to create speed profile')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.createSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.speedProfiles(),
      });
      options?.onSaved?.();
    },
  });
}

export function useUpdateWifiSpeedProfile(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async ({ id, json }: { id: string; json: any }) => {
      const res = await api.wifi['speed-profiles'][':id'].$put({
        json,
        param: { id },
      });
      if (!res.ok) {
        throw new Error('Failed to update speed profile');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminProfiles.updateError', 'Failed to update speed profile')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.updateSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.speedProfiles(),
      });
      options?.onSaved?.();
    },
  });
}

export function useDeleteWifiSpeedProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.wifi['speed-profiles'][':id'].$delete({
        param: { id },
      });
      if (!res.ok) {
        throw new Error('Failed to delete speed profile');
      }
      return res.json();
    },
    onError: () => toast.error(t('wifiAdminProfiles.deleteError')),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.deleteSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.speedProfiles(),
      });
    },
  });
}

export function useCreateWifiRoleProfile(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async (json: any) => {
      const res = await api.wifi['role-speed-profiles'].$post({ json });
      if (!res.ok) {
        throw new Error('Failed to create role profile');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminProfiles.createMappingError', 'Failed to create mapping')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.createMappingSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.roleProfiles(),
      });
      options?.onSaved?.();
    },
  });
}

export function useUpdateWifiRoleProfile(options?: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    // biome-ignore lint/suspicious/noExplicitAny: API workaround
    mutationFn: async ({ id, json }: { id: string; json: any }) => {
      const res = await api.wifi['role-speed-profiles'][':id'].$put({
        json,
        param: { id },
      });
      if (!res.ok) {
        throw new Error('Failed to update role profile');
      }
      return res.json();
    },
    onError: () =>
      toast.error(
        t('wifiAdminProfiles.updateMappingError', 'Failed to update mapping')
      ),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.updateMappingSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.roleProfiles(),
      });
      options?.onSaved?.();
    },
  });
}

export function useDeleteWifiRoleProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.wifi['role-speed-profiles'][':id'].$delete({
        param: { id },
      });
      if (!res.ok) {
        throw new Error('Failed to delete role profile');
      }
      return res.json();
    },
    onError: () => toast.error(t('wifiAdminProfiles.deleteMappingError')),
    onSuccess: () => {
      toast.success(t('wifiAdminProfiles.deleteMappingSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.wifi.admin.roleProfiles(),
      });
    },
  });
}
