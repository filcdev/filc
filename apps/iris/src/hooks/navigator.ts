import type {
  Building,
  CreateBuildingInput,
  UpdateBuildingInput,
} from '@filcdev/api/domains/navigator/building';
import type {
  CreateClassroomInput,
  UpdateClassroomInput,
} from '@filcdev/api/domains/navigator/classroom';
import type {
  ClassroomType,
  CreateClassroomTypeInput,
  UpdateClassroomTypeInput,
} from '@filcdev/api/domains/navigator/classroom-type';
import type {
  Corridor,
  CreateCorridorInput,
  UpdateCorridorInput,
} from '@filcdev/api/domains/navigator/corridor';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type {
  CreateLiftInput,
  Lift,
  UpdateLiftInput,
} from '@filcdev/api/domains/navigator/lift';
import type {
  CreateStairInput,
  Stair,
  UpdateStairInput,
} from '@filcdev/api/domains/navigator/stair';
import type {
  CreateTranslationInput,
  Translation,
  UpdateTranslationInput,
} from '@filcdev/api/domains/navigator/translation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

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
export type ClassroomRow = NonNullable<
  InferResponseType<typeof api.navigator.classrooms.$get>['data']
>['classrooms'][number];

/** The whole campus in one payload; the canvas builds its scene from this. */
export function useNavigatorGraph() {
  return useQuery({
    queryFn: async (): Promise<FullGraph> => {
      const res = await parseResponse(api.navigator.graph.$get());
      if (!res.success) {
        throw new Error('Failed to load navigator graph');
      }
      return res.data;
    },
    queryKey: queryKeys.navigator.graph(),
  });
}

/** All campus buildings. */
export function useBuildings() {
  return useQuery({
    queryFn: async (): Promise<Building[]> => {
      const res = await parseResponse(api.navigator.buildings.$get());
      if (!res.success) {
        throw new Error('Failed to load buildings');
      }
      return res.data.buildings;
    },
    queryKey: queryKeys.navigator.buildings(),
  });
}

/** All classroom categories. */
export function useClassroomTypes() {
  return useQuery({
    queryFn: async (): Promise<ClassroomType[]> => {
      const res = await parseResponse(api.navigator['classroom-types'].$get());
      if (!res.success) {
        throw new Error('Failed to load classroom types');
      }
      return res.data.classroom_types;
    },
    queryKey: queryKeys.navigator.classroomTypes(),
  });
}

/** All classrooms, including the ones the campus has not placed yet. */
export function useClassrooms() {
  return useQuery({
    queryFn: async (): Promise<ClassroomRow[]> => {
      const res = await parseResponse(api.navigator.classrooms.$get());
      if (!res.success) {
        throw new Error('Failed to load classrooms');
      }
      return res.data.classrooms;
    },
    queryKey: queryKeys.navigator.classrooms(),
  });
}

/** All corridor segments. */
export function useCorridors() {
  return useQuery({
    queryFn: async (): Promise<Corridor[]> => {
      const res = await parseResponse(api.navigator.corridors.$get());
      if (!res.success) {
        throw new Error('Failed to load corridors');
      }
      return res.data.corridors;
    },
    queryKey: queryKeys.navigator.corridors(),
  });
}

/** All lift shafts. */
export function useLifts() {
  return useQuery({
    queryFn: async (): Promise<Lift[]> => {
      const res = await parseResponse(api.navigator.lifts.$get());
      if (!res.success) {
        throw new Error('Failed to load lifts');
      }
      return res.data.lifts;
    },
    queryKey: queryKeys.navigator.lifts(),
  });
}

/** All staircases. */
export function useStairs() {
  return useQuery({
    queryFn: async (): Promise<Stair[]> => {
      const res = await parseResponse(api.navigator.stairs.$get());
      if (!res.success) {
        throw new Error('Failed to load stairs');
      }
      return res.data.stairs;
    },
    queryKey: queryKeys.navigator.stairs(),
  });
}

/** Every translation row (auth-only admin view). */
export function useNavigatorTranslations() {
  return useQuery({
    queryFn: async (): Promise<Translation[]> => {
      const res = await parseResponse(api.navigator.translations.$get());
      if (!res.success) {
        throw new Error('Failed to load translations');
      }
      return res.data.translations;
    },
    queryKey: queryKeys.navigator.translations(),
  });
}

/** Languages that currently have at least one translation row. */
export function useAvailableLanguages() {
  return useQuery({
    queryFn: async (): Promise<string[]> => {
      const res = await parseResponse(
        api.navigator.translations.available.$get()
      );
      if (!res.success) {
        throw new Error('Failed to load languages');
      }
      return res.data.languages;
    },
    queryKey: queryKeys.navigator.availableLanguages(),
  });
}

/** Invalidate the campus graph and an arbitrary set of navigator collections. */
function useInvalidateNavigator() {
  const queryClient = useQueryClient();
  return (keys: readonly (readonly unknown[])[]) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.navigator.graph() });
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

/** Create a building; the campus graph gains a new building node. */
export function useCreateBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateBuildingInput) => {
      const res = await parseResponse(
        api.navigator.buildings.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create building');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.buildings()]);
      onSaved?.();
    },
  });
}

/** Update a building's name, description or origin. */
export function useUpdateBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateBuildingInput;
    }) => {
      const res = await parseResponse(
        api.navigator.buildings[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update building');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.buildings()]);
      onSaved?.();
    },
  });
}

/** Delete a building; its classrooms, corridors, lifts and stairs cascade. */
export function useDeleteBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.buildings[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete building');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([
        queryKeys.navigator.buildings(),
        queryKeys.navigator.classrooms(),
        queryKeys.navigator.corridors(),
        queryKeys.navigator.lifts(),
        queryKeys.navigator.stairs(),
      ]);
      onSaved?.();
    },
  });
}

/** Create a classroom category. */
export function useCreateClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateClassroomTypeInput) => {
      const res = await parseResponse(
        api.navigator['classroom-types'].$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create classroom type');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.classroomTypes()]);
      onSaved?.();
    },
  });
}

/** Update a classroom category. */
export function useUpdateClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateClassroomTypeInput;
    }) => {
      const res = await parseResponse(
        api.navigator['classroom-types'][':id'].$put({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update classroom type');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.classroomTypes()]);
      onSaved?.();
    },
  });
}

/** Delete a category; rejected with a conflict while classrooms still use it. */
export function useDeleteClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator['classroom-types'][':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete classroom type');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([
        queryKeys.navigator.classroomTypes(),
        queryKeys.navigator.classrooms(),
      ]);
      onSaved?.();
    },
  });
}

/** Create a classroom. */
export function useCreateClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateClassroomInput) => {
      const res = await parseResponse(
        api.navigator.classrooms.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create classroom');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.classrooms()]);
      onSaved?.();
    },
  });
}

/** Update a classroom. */
export function useUpdateClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateClassroomInput;
    }) => {
      const res = await parseResponse(
        api.navigator.classrooms[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update classroom');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.classrooms()]);
      onSaved?.();
    },
  });
}

/** Delete a classroom. */
export function useDeleteClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.classrooms[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete classroom');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([queryKeys.navigator.classrooms()]);
      onSaved?.();
    },
  });
}

/** Create a corridor segment. */
export function useCreateCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateCorridorInput) => {
      const res = await parseResponse(
        api.navigator.corridors.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create corridor');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.corridors()]);
      onSaved?.();
    },
  });
}

/** Update a corridor segment. */
export function useUpdateCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCorridorInput;
    }) => {
      const res = await parseResponse(
        api.navigator.corridors[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update corridor');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.corridors()]);
      onSaved?.();
    },
  });
}

/** Delete a corridor segment. */
export function useDeleteCorridor({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.corridors[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete corridor');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([queryKeys.navigator.corridors()]);
      onSaved?.();
    },
  });
}

/** Create a lift shaft. */
export function useCreateLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateLiftInput) => {
      const res = await parseResponse(
        api.navigator.lifts.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create lift');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.lifts()]);
      onSaved?.();
    },
  });
}

/** Update a lift shaft. */
export function useUpdateLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateLiftInput;
    }) => {
      const res = await parseResponse(
        api.navigator.lifts[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update lift');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.lifts()]);
      onSaved?.();
    },
  });
}

/** Delete a lift shaft. */
export function useDeleteLift({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.lifts[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete lift');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([queryKeys.navigator.lifts()]);
      onSaved?.();
    },
  });
}

/** Create a staircase. */
export function useCreateStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateStairInput) => {
      const res = await parseResponse(
        api.navigator.stairs.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create stair');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.createError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.createSuccess'));
      invalidate([queryKeys.navigator.stairs()]);
      onSaved?.();
    },
  });
}

/** Update a staircase. */
export function useUpdateStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateStairInput;
    }) => {
      const res = await parseResponse(
        api.navigator.stairs[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update stair');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.updateError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.updateSuccess'));
      invalidate([queryKeys.navigator.stairs()]);
      onSaved?.();
    },
  });
}

/** Delete a staircase. */
export function useDeleteStair({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.stairs[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete stair');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.deleteSuccess'));
      invalidate([queryKeys.navigator.stairs()]);
      onSaved?.();
    },
  });
}

function useInvalidateTranslations() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.navigator.translations(),
    });
}

/** Create or replace one codename across every provided language. */
export function useSaveNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateTranslationInput) => {
      const res = await parseResponse(
        api.navigator.translations.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save translation');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.translations.saveError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.translations.saveSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update one codename's text in one language. */
export function useUpdateNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      key,
      lang,
      payload,
    }: {
      key: string;
      lang: string;
      payload: UpdateTranslationInput;
    }) => {
      const res = await parseResponse(
        api.navigator.translations[':lang'][':key'].$put({
          json: payload,
          param: { key, lang },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update translation');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.translations.saveError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.translations.saveSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete one codename's text in one language. */
export function useDeleteNavigatorTranslation({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateTranslations();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ key, lang }: { key: string; lang: string }) => {
      const res = await parseResponse(
        api.navigator.translations[':lang'][':key'].$delete({
          param: { key, lang },
        })
      );
      if (!res.success) {
        throw new Error('Failed to delete translation');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.translations.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.translations.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** The versioned JSON payload the import endpoint accepts. */
export type NavigatorExportPayload = InferRequestType<
  typeof api.navigator.import.$post
>['json'];

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
  const res = await parseResponse(api.navigator.export.$get());
  if (!res.success) {
    throw new Error('Failed to export navigator data');
  }
  downloadBlob(
    new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' }),
    `navigator-export-${new Date().toISOString().slice(0, 10)}.json`
  );
}

/** Replace all navigator data with the contents of an export JSON payload. */
export function useImportNavigator({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      payload,
      clear,
    }: {
      payload: NavigatorExportPayload;
      clear: boolean;
    }) => {
      const res = await parseResponse(
        api.navigator.import.$post({
          json: payload,
          query: { clear: clear ? 'true' : 'false' },
        })
      );
      if (!res.success) {
        throw new Error('Failed to import navigator data');
      }
      return res;
    },
    onError: () => {
      toast.error(t('navigator.transfer.importError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.transfer.importSuccess'));
      invalidate([
        queryKeys.navigator.buildings(),
        queryKeys.navigator.classroomTypes(),
        queryKeys.navigator.classrooms(),
        queryKeys.navigator.corridors(),
        queryKeys.navigator.lifts(),
        queryKeys.navigator.stairs(),
        queryKeys.navigator.translations(),
        queryKeys.navigator.availableLanguages(),
      ]);
      onSaved?.();
    },
  });
}
