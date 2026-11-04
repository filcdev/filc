import { authClient } from '@filcdev/auth/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { orpc } from '@/utils/orpc';
import type { MutationCallbacks } from './types';

/**
 * Refetches the session every `useSession` consumer reads, so the navbar's
 * avatar shows the new picture. This is the signal better-auth's own
 * `/update-user` notifies, and the client refetches on it — an oRPC write has
 * no such hook of its own.
 */
const refreshSession = () => authClient.$store.notify('$sessionSignal');

/** Sets the caller's own profile picture from a picked file. */
export function useUploadAvatar({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.users.avatar.upload.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('profile.picture.uploadError'));
      },
      onSuccess: () => {
        toast.success(t('profile.picture.uploadSuccess'));
        refreshSession();
        // The admin user list and published blog posts both project the image.
        queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
        onSaved?.();
      },
    })
  );
}

/** Clears the caller's own profile picture. */
export function useRemoveAvatar({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.users.avatar.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('profile.picture.removeError'));
      },
      onSuccess: () => {
        toast.success(t('profile.picture.removeSuccess'));
        refreshSession();
        queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
        onSaved?.();
      },
    })
  );
}
