import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

type BuildingsData = NonNullable<
  InferResponseType<typeof api.navigator.buildings.$get>['data']
>;
type ClassroomTypesData = NonNullable<
  InferResponseType<(typeof api.navigator)['classroom-types']['$get']>['data']
>;
type ClassroomsData = NonNullable<
  InferResponseType<typeof api.navigator.classrooms.$get>['data']
>;
type UtilitiesData = NonNullable<
  InferResponseType<typeof api.navigator.utilities.$get>['data']
>;
type TranslationsData = NonNullable<
  InferResponseType<typeof api.navigator.translations.$get>['data']
>;
type NavigatorGraphData = NonNullable<
  InferResponseType<typeof api.navigator.graph.$get>['data']
>;

export type NavigatorBuilding = BuildingsData['buildings'][number];
export type NavigatorClassroomType =
  ClassroomTypesData['classroomTypes'][number];
export type NavigatorClassroom = ClassroomsData['classrooms'][number];
export type NavigatorUtility = UtilitiesData['utilities'][number];
export type NavigatorTranslation = TranslationsData['translations'][number];
export type NavigatorGraph = NavigatorGraphData;

export type BuildingPayload = InferRequestType<
  typeof api.navigator.buildings.$post
>['json'];
export type ClassroomTypePayload = InferRequestType<
  (typeof api.navigator)['classroom-types']['$post']
>['json'];
export type ClassroomPayload = InferRequestType<
  typeof api.navigator.classrooms.$post
>['json'];
export type UtilityPayload = InferRequestType<
  typeof api.navigator.utilities.$post
>['json'];
export type TranslationPayload = InferRequestType<
  typeof api.navigator.translations.$post
>['json'];
export type UpdateTranslationPayload = InferRequestType<
  (typeof api.navigator.translations)[':lang'][':key']['$put']
>['json'];
export type NavigatorExportPayload = InferRequestType<
  typeof api.navigator.import.$post
>['json'];

/** All navigator buildings. */
export function useBuildings() {
  return useQuery({
    queryFn: async (): Promise<BuildingsData> => {
      const res = await parseResponse(api.navigator.buildings.$get());
      if (!res.success) {
        throw new Error('Failed to load buildings');
      }
      return res.data as BuildingsData;
    },
    queryKey: queryKeys.navigator.buildings(),
  });
}

/** All navigator classroom types. */
export function useClassroomTypes() {
  return useQuery({
    queryFn: async (): Promise<ClassroomTypesData> => {
      const res = await parseResponse(api.navigator['classroom-types'].$get());
      if (!res.success) {
        throw new Error('Failed to load classroom types');
      }
      return res.data as ClassroomTypesData;
    },
    queryKey: queryKeys.navigator.classroomTypes(),
  });
}

/** All navigator classrooms. */
export function useClassrooms() {
  return useQuery({
    queryFn: async (): Promise<ClassroomsData> => {
      const res = await parseResponse(api.navigator.classrooms.$get());
      if (!res.success) {
        throw new Error('Failed to load classrooms');
      }
      return res.data as ClassroomsData;
    },
    queryKey: queryKeys.navigator.classrooms(),
  });
}

/** All navigator utilities. */
export function useUtilities() {
  return useQuery({
    queryFn: async (): Promise<UtilitiesData> => {
      const res = await parseResponse(
        api.navigator.utilities.$get({ query: {} })
      );
      if (!res.success) {
        throw new Error('Failed to load utilities');
      }
      return res.data as UtilitiesData;
    },
    queryKey: queryKeys.navigator.utilities(),
  });
}

/** All navigator translation entries. */
export function useTranslations() {
  return useQuery({
    queryFn: async (): Promise<TranslationsData> => {
      const res = await parseResponse(api.navigator.translations.$get());
      if (!res.success) {
        throw new Error('Failed to load translations');
      }
      return res.data as TranslationsData;
    },
    queryKey: queryKeys.navigator.translations(),
  });
}

/** The complete navigator graph (buildings, types, rooms, utilities). */
export function useNavigatorGraph() {
  return useQuery({
    queryFn: async (): Promise<NavigatorGraphData> => {
      const res = await parseResponse(api.navigator.graph.$get());
      if (!res.success) {
        throw new Error('Failed to load navigator graph');
      }
      return res.data as NavigatorGraphData;
    },
    queryKey: queryKeys.navigator.graph(),
  });
}

function useInvalidateNavigator() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.navigator.root() });
}

/** Create or update a navigator building. */
export function useUpsertBuilding({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: BuildingPayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.navigator.buildings[':id'].$put({
              json: payload,
              param: { id },
            })
          : api.navigator.buildings.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save building');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.buildings.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('navigator.buildings.updateSuccess')
          : t('navigator.buildings.createSuccess')
      );
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a navigator building by id. */
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
      toast.error(error.message || t('navigator.buildings.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.buildings.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create or update a navigator classroom type. */
export function useUpsertClassroomType({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: ClassroomTypePayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.navigator['classroom-types'][':id'].$put({
              json: payload,
              param: { id },
            })
          : api.navigator['classroom-types'].$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save classroom type');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.classroomTypes.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('navigator.classroomTypes.updateSuccess')
          : t('navigator.classroomTypes.createSuccess')
      );
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a navigator classroom type by id. */
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
      toast.error(error.message || t('navigator.classroomTypes.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.classroomTypes.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create or update a navigator classroom. */
export function useUpsertClassroom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: ClassroomPayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.navigator.classrooms[':id'].$put({
              json: payload,
              param: { id },
            })
          : api.navigator.classrooms.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save classroom');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.classrooms.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('navigator.classrooms.updateSuccess')
          : t('navigator.classrooms.createSuccess')
      );
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a navigator classroom by id. */
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
      toast.error(error.message || t('navigator.classrooms.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.classrooms.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create or update a navigator utility. */
export function useUpsertUtility({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: UtilityPayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.navigator.utilities[':id'].$put({
              json: payload,
              param: { id },
            })
          : api.navigator.utilities.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save utility');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.utilities.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('navigator.utilities.updateSuccess')
          : t('navigator.utilities.createSuccess')
      );
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a navigator utility by id. */
export function useDeleteUtility({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.navigator.utilities[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete utility');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.utilities.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.utilities.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create a new navigator translation entry. */
export function useCreateTranslation({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: TranslationPayload) => {
      const res = await parseResponse(
        api.navigator.translations.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create translation');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.translations.saveError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.translations.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update the text of a navigator translation entry by language and key. */
export function useUpdateTranslation({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      key,
      lang,
      payload,
    }: {
      key: string;
      lang: string;
      payload: UpdateTranslationPayload;
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
      toast.success(t('navigator.translations.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a navigator translation entry by language and key. */
export function useDeleteTranslation({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
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
 * Download the full navigator graph as a JSON file. Not a React hook: the
 * caller drives the busy state and surfaces errors via a toast.
 */
export async function exportNavigatorJson(): Promise<void> {
  const res = await api.navigator.export.$get();
  if (!res.ok) {
    throw new Error('Export failed');
  }
  const text = await res.text();
  downloadBlob(
    new Blob([text], { type: 'application/json' }),
    `navigator-export-${new Date().toISOString().slice(0, 10)}.json`
  );
}

/** Replace all navigator data with the contents of an export JSON payload. */
export function useImportNavigator({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateNavigator();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: NavigatorExportPayload) => {
      const res = await parseResponse(
        api.navigator.import.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to import navigator data');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('navigator.transfer.importError'));
    },
    onSuccess: () => {
      toast.success(t('navigator.transfer.importSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
