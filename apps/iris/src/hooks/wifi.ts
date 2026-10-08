import { isDefinedError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

export type WifiStatus = Awaited<ReturnType<typeof api.wifi.status>>;

type SelfData = Awaited<ReturnType<typeof api.wifi.self.get>>;
export type WifiSelfData = SelfData['wifi'];
export type WifiSelfDevice = WifiSelfData['devices'][number];

/**
 * Whether the module is on, and the SSID it authenticates. Reachable without a
 * session and without the module being enabled — it is what the apps read to
 * decide whether to render any WiFi surface at all.
 */
export function useWifiStatus() {
  return useQuery(orpc.wifi.status.queryOptions());
}

/**
 * The signed-in user's WiFi account. A 404 is the "no account yet" state the
 * page renders as a setup form, so it must not be retried.
 */
export function useWifiSelf(enabled = true) {
  return useQuery({
    ...orpc.wifi.self.get.queryOptions(),
    enabled,
    retry: (failureCount, error) =>
      !(isDefinedError(error) && error.code === 'NOT_FOUND') &&
      failureCount < 2,
  });
}

const invalidateSelf = (
  queryClient: ReturnType<typeof useQueryClient>
): void => {
  queryClient.invalidateQueries({ queryKey: orpc.wifi.self.get.key() });
};

/** Create the signed-in user's WiFi account. */
export function useCreateWifiAccount({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.self.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifi.createAccountError'));
      },
      onSuccess: () => {
        invalidateSelf(queryClient);
        toast.success(t('wifi.createAccountSuccess'));
        onSaved?.();
      },
    })
  );
}

/** Change the signed-in user's WiFi password. */
export function useUpdateWifiPassword({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.self.changePassword.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifi.passwordChangeError'));
      },
      onSuccess: () => {
        invalidateSelf(queryClient);
        toast.success(t('wifi.passwordChangeSuccess'));
        onSaved?.();
      },
    })
  );
}

/** Rename one of the signed-in user's devices. */
export function useUpdateWifiDevice({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.self.updateDevice.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifi.deviceUpdateError'));
      },
      onSuccess: () => {
        invalidateSelf(queryClient);
        toast.success(t('wifi.deviceUpdateSuccess'));
        onSaved?.();
      },
    })
  );
}

/** Download the network CA certificate the account needs to join. */
export function useDownloadWifiCertificate({
  onSaved,
}: MutationCallbacks = {}) {
  const { t } = useTranslation();
  return useMutation(
    orpc.wifi.self.certificate.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('wifi.certificateDownloadError'));
      },
      onSuccess: (file) => {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.download = 'wifi-ca.pem';
        anchor.href = url;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast.success(t('wifi.certificateDownloadSuccess'));
        onSaved?.();
      },
    })
  );
}
