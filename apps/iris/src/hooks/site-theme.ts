import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { orpc } from '@/utils/orpc';

/**
 * The site-wide seasonal skin. Public (signed-out visitors render it) and read
 * during SSR, so a finite `staleTime` keeps the hydrated value from triggering
 * an immediate client refetch the moment the page becomes interactive.
 */
export function useSiteTheme() {
  return useQuery(orpc.theme.get.queryOptions({ staleTime: 5 * 60_000 }));
}

/** Set the site-wide seasonal theme. The backend is admin-only. */
export function useUpdateSiteTheme({ onSaved }: { onSaved?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.theme.update.mutationOptions({
      onError: () => {
        toast.error(t('siteTheme.saveError'));
      },
      onSuccess: () => {
        // A bare `.key()` matches every input of the procedure, so the public
        // `useSiteTheme` cache is invalidated and re-reads the new value.
        queryClient.invalidateQueries({ queryKey: orpc.theme.key() });
        toast.success(t('siteTheme.saved'));
        onSaved?.();
      },
    })
  );
}
