import { ApiError } from '@filcdev/api/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

export type WifiStatus = NonNullable<
  InferResponseType<typeof api.wifi.status.$get>['data']
>;

export type WifiSelfData = NonNullable<
  InferResponseType<typeof api.wifi.self.$get>['data']
>;

export function useWifiStatus() {
  return useApiQuery<WifiStatus>(() => api.wifi.status.$get(), {
    queryKey: queryKeys.wifi.status(),
  });
}

export function useWifiSelf(enabled = true) {
  return useApiQuery<WifiSelfData>(() => api.wifi.self.$get(), {
    enabled,
    queryKey: queryKeys.wifi.self(),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });
}

export function useCreateWifiAccount() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) => {
      const response = await api.wifi.self.$post({
        json: { password },
      });

      if (!response.ok) {
        throw new Error('Failed to create WiFi account');
      }

      return response.json();
    },
    onError: (_error) => {
      toast.error(t('wifi.createAccountError'));
    },
    onSuccess: () => {
      toast.success(t('wifi.createAccountSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.self() });
    },
  });
}

export function useUpdateWifiPassword() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPassword: string) => {
      const response = await api.wifi.self.password.$put({
        json: { newPassword },
      });

      if (!response.ok) {
        throw new Error('Failed to update password');
      }

      return response.json();
    },
    onError: (_error) => {
      toast.error(t('wifi.passwordChangeError'));
    },
    onSuccess: () => {
      toast.success(t('wifi.passwordChangeSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.self() });
    },
  });
}

export function useUpdateWifiDevice() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { deviceId: string; nickname: string | null }) => {
      const response = await api.wifi.self.devices[':id'].$put({
        json: { nickname: vars.nickname },
        param: { id: vars.deviceId },
      });

      if (!response.ok) {
        throw new Error('Failed to update device');
      }

      return response.json();
    },
    onError: (_error) => {
      toast.error(t('wifi.deviceUpdateError'));
    },
    onSuccess: () => {
      toast.success(t('wifi.deviceUpdateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.wifi.self() });
    },
  });
}

export function useDownloadWifiCertificate() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await api.wifi.self.certificate.$get();

      if (!response.ok) {
        throw new Error('Failed to download certificate');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wifi-ca.pem';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return blob;
    },
    onError: (_error) => {
      toast.error(t('wifi.certificateDownloadError'));
    },
    onSuccess: () => {
      toast.success(t('wifi.certificateDownloadSuccess'));
    },
  });
}
