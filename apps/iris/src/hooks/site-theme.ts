import { ERROR_CODE } from '@filcdev/api/errors';
import { isDefinedError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';
import type { MutationCallbacks } from './types';

type ThemeScheduleList = Awaited<
  ReturnType<typeof api.theme.schedule.list>
>['items'];

/** One annual window of the theme schedule, with `active` computed by the
 *  backend for today. */
export type ThemeScheduleItem = ThemeScheduleList[number];

/**
 * The site-wide seasonal skin. Public (signed-out visitors render it) and read
 * during SSR, so a finite `staleTime` keeps the hydrated value from triggering
 * an immediate client refetch the moment the page becomes interactive.
 */
export function useSiteTheme() {
  return useQuery(orpc.theme.get.queryOptions({ staleTime: 5 * 60_000 }));
}

/**
 * `orpc.theme.key()` is the router-level prefix, so one invalidation covers
 * `theme.get`, `theme.update` and the whole `theme.schedule` subtree: the
 * picker's public read and the schedule list always agree.
 */
function useInvalidateTheme() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.theme.key() });
}

/** The admin-editable annual schedule, earliest window first. */
export function useThemeSchedule() {
  return useQuery({
    ...orpc.theme.schedule.list.queryOptions(),
    select: (data) => data.items,
  });
}

/** Set the site-wide seasonal theme. The backend is admin-only. */
export function useUpdateSiteTheme({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTheme();
  const { t } = useTranslation();
  return useMutation(
    orpc.theme.update.mutationOptions({
      onError: () => {
        toast.error(t('siteTheme.saveError'));
      },
      onSuccess: () => {
        invalidate();
        toast.success(t('siteTheme.saved'));
        onSaved?.();
      },
    })
  );
}

/** Add an annual window. Windows may not overlap, so a CONFLICT gets the
 *  schedule's own message instead of the backend's English one. */
export function useCreateThemeSchedule({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTheme();
  const { t } = useTranslation();
  return useMutation(
    orpc.theme.schedule.create.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === ERROR_CODE.CONFLICT
            ? t('siteTheme.schedule.overlapError')
            : error.message || t('siteTheme.schedule.saveError')
        );
      },
      onSuccess: () => {
        invalidate();
        toast.success(t('siteTheme.schedule.created'));
        onSaved?.();
      },
    })
  );
}

/** Edit an annual window; the merged window is overlap-checked server-side. */
export function useUpdateThemeSchedule({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTheme();
  const { t } = useTranslation();
  return useMutation(
    orpc.theme.schedule.update.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === ERROR_CODE.CONFLICT
            ? t('siteTheme.schedule.overlapError')
            : error.message || t('siteTheme.schedule.saveError')
        );
      },
      onSuccess: () => {
        invalidate();
        toast.success(t('siteTheme.schedule.updated'));
        onSaved?.();
      },
    })
  );
}

/** Remove an annual window. */
export function useDeleteThemeSchedule({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTheme();
  const { t } = useTranslation();
  return useMutation(
    orpc.theme.schedule.delete.mutationOptions({
      onError: () => {
        toast.error(t('siteTheme.schedule.deleteError'));
      },
      onSuccess: () => {
        invalidate();
        toast.success(t('siteTheme.schedule.deleted'));
        onSaved?.();
      },
    })
  );
}
