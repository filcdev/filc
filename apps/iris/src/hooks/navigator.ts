import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, orpc } from '@/utils/orpc';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/**
 * A room row as the campus list returns it. The list also carries the rooms the
 * timetable imported, and those have no campus capacity or type until someone
 * places them on the map: only the graph normalizes those two away.
 */
export type ClassroomRow = Awaited<
  ReturnType<typeof api.navigator.classrooms.list>
>['classrooms'][number];

/** The whole campus in one payload; the canvas builds its scene from this. */
export function useNavigatorGraph() {
  return useQuery(orpc.navigator.graph.queryOptions());
}

/** All campus buildings. */
export function useBuildings() {
  return useQuery({
    ...orpc.navigator.buildings.list.queryOptions(),
    select: (payload) => payload.buildings,
  });
}

/** All classroom categories. */
export function useClassroomTypes() {
  return useQuery({
    ...orpc.navigator.classroomTypes.list.queryOptions(),
    select: (payload) => payload.classroom_types,
  });
}

/** All classrooms, including the ones the campus has not placed yet. */
export function useClassrooms() {
  return useQuery({
    ...orpc.navigator.classrooms.list.queryOptions(),
    select: (payload) => payload.classrooms,
  });
}

/** All corridor segments. */
export function useCorridors() {
  return useQuery({
    ...orpc.navigator.corridors.list.queryOptions(),
    select: (payload) => payload.corridors,
  });
}

/** All lift shafts. */
export function useLifts() {
  return useQuery({
    ...orpc.navigator.lifts.list.queryOptions(),
    select: (payload) => payload.lifts,
  });
}

/** All staircases. */
export function useStairs() {
  return useQuery({
    ...orpc.navigator.stairs.list.queryOptions(),
    select: (payload) => payload.stairs,
  });
}

/** Every translation row (auth-only admin view). */
export function useNavigatorTranslations() {
  return useQuery({
    ...orpc.navigator.translations.list.queryOptions(),
    select: (payload) => payload.translations,
  });
}

/** Languages that currently have at least one translation row. */
export function useAvailableLanguages() {
  return useQuery({
    ...orpc.navigator.translations.available.queryOptions(),
    select: (payload) => payload.languages,
  });
}

/**
 * Invalidate the campus graph and an arbitrary set of navigator collections.
 * Every such write changes the graph's shape, so the graph key always goes.
 */
function useInvalidateNavigator() {
  const queryClient = useQueryClient();
  return (keys: readonly (readonly unknown[])[]) => {
    queryClient.invalidateQueries({ queryKey: orpc.navigator.graph.key() });
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

/** Create a building; the campus graph gains a new building node. */
export function useCreateBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.buildings.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.buildings.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a building's name, description or origin. */
export function useUpdateBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.buildings.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.buildings.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a building; its classrooms, corridors, lifts and stairs cascade. */
export function useDeleteBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.buildings.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([
          orpc.navigator.buildings.list.key(),
          orpc.navigator.classrooms.list.key(),
          orpc.navigator.corridors.list.key(),
          orpc.navigator.lifts.list.key(),
          orpc.navigator.stairs.list.key(),
        ]);
        onSaved?.();
      },
    })
  );
}

/** Create a classroom category. */
export function useCreateClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classroomTypes.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.classroomTypes.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a classroom category. */
export function useUpdateClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classroomTypes.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.classroomTypes.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a category; rejected with a conflict while classrooms still use it. */
export function useDeleteClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classroomTypes.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([
          orpc.navigator.classroomTypes.list.key(),
          orpc.navigator.classrooms.list.key(),
        ]);
        onSaved?.();
      },
    })
  );
}

/** Create a classroom. */
export function useCreateClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classrooms.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.classrooms.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a classroom. */
export function useUpdateClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classrooms.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.classrooms.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a classroom. */
export function useDeleteClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.classrooms.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([orpc.navigator.classrooms.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Create a corridor segment. */
export function useCreateCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.corridors.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.corridors.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a corridor segment. */
export function useUpdateCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.corridors.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.corridors.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a corridor segment. */
export function useDeleteCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.corridors.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([orpc.navigator.corridors.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Create a lift shaft. */
export function useCreateLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.lifts.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.lifts.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a lift shaft. */
export function useUpdateLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.lifts.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.lifts.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a lift shaft. */
export function useDeleteLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.lifts.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([orpc.navigator.lifts.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Create a staircase. */
export function useCreateStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.stairs.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.createError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.createSuccess'));
        invalidate([orpc.navigator.stairs.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Update a staircase. */
export function useUpdateStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.stairs.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.updateError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.updateSuccess'));
        invalidate([orpc.navigator.stairs.list.key()]);
        onSaved?.();
      },
    })
  );
}

/** Delete a staircase. */
export function useDeleteStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.stairs.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.deleteSuccess'));
        invalidate([orpc.navigator.stairs.list.key()]);
        onSaved?.();
      },
    })
  );
}

function useInvalidateTranslations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.navigator.translations.list.key(),
    });
  };
}

/** Create or replace one codename across every provided language. */
export function useSaveNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.translations.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.translations.saveError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.translations.saveSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update one codename's text in one language. */
export function useUpdateNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.translations.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.translations.saveError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.translations.saveSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete one codename's text in one language. */
export function useDeleteNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.translations.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('navigator.translations.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.translations.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** The multipart body the import endpoint accepts. */
export type NavigatorImportPayload = Parameters<typeof api.navigator.import>[0];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download the full navigator data as a JSON file. Not a React hook: the
 * caller drives the busy state and surfaces errors via a toast.
 */
export async function exportNavigatorJson(): Promise<void> {
  const exportFile = await api.navigator.export();
  downloadBlob(
    exportFile,
    `navigator-export-${new Date().toISOString().slice(0, 10)}.json`
  );
}

/** Insert or update all navigator data from an export JSON file. */
export function useImportNavigator({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation(
    orpc.navigator.import.mutationOptions({
      onError: () => {
        toast.error(t('navigator.transfer.importError'));
      },
      onSuccess: () => {
        toast.success(t('navigator.transfer.importSuccess'));
        invalidate([
          orpc.navigator.buildings.list.key(),
          orpc.navigator.classroomTypes.list.key(),
          orpc.navigator.classrooms.list.key(),
          orpc.navigator.corridors.list.key(),
          orpc.navigator.lifts.list.key(),
          orpc.navigator.stairs.list.key(),
          orpc.navigator.translations.list.key(),
          orpc.navigator.translations.available.key(),
        ]);
        onSaved?.();
      },
    })
  );
}
