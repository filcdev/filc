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

type TeachersAdminResponse = InferResponseType<
  (typeof api.timetable.teachers)['$get']
>;

/** A teacher as returned by the admin list (email + linked user included). */
export type AdminTeacher = NonNullable<TeachersAdminResponse['data']>[number];

type UserOptionsResponse = InferResponseType<(typeof api.users.index)['$get']>;

/** A user available for the teacher assignment picker. */
export type TeacherUserOption = NonNullable<
  UserOptionsResponse['data']
>['users'][number];

type UpdateTeacherPayload = InferRequestType<
  (typeof api.timetable.teachers)[':id']['$patch']
>['json'];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Admin teacher list (email + linked user); gated by `teacher:manage`. */
export function useTeachersAdmin() {
  return useQuery({
    queryFn: async (): Promise<AdminTeacher[]> => {
      const res = await parseResponse(api.timetable.teachers.$get());
      if (!res.success) {
        throw new Error('Failed to load teachers');
      }
      return (res.data ?? []) as AdminTeacher[];
    },
    queryKey: queryKeys.adminTeachers(),
  });
}

/**
 * Users for the teacher assignment picker. The list endpoint caps `limit` at
 * 100, so page through it to offer every assignable account; a failed page
 * falls back to an empty list so the combobox stays usable.
 */
export function useTeacherUserOptions() {
  return useQuery({
    queryFn: async (): Promise<TeacherUserOption[]> => {
      try {
        const pageSize = 100;
        const users: TeacherUserOption[] = [];
        let offset = 0;
        let total = Number.POSITIVE_INFINITY;
        while (users.length < total) {
          const res = await parseResponse(
            api.users.index.$get({
              query: {
                limit: String(pageSize),
                offset: String(offset),
              },
            })
          );
          if (!res.success) {
            return [];
          }
          const page = res.data?.users ?? [];
          users.push(...page);
          total = res.data?.total ?? users.length;
          if (page.length < pageSize) {
            break;
          }
          offset += pageSize;
        }
        return users;
      } catch {
        return [];
      }
    },
    queryKey: queryKeys.userOptions(),
  });
}

/** Update a teacher's email and/or linked user. */
export function useUpdateTeacher({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: UpdateTeacherPayload & { id: string }) => {
      const res = await api.timetable.teachers[':id'].$patch({
        json: payload,
        param: { id },
      });
      if (!res.ok) {
        throw new Error(t('teachers.updateError'));
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('teachers.updateError'));
    },
    onSuccess: () => {
      toast.success(t('teachers.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTeachers() });
      onSaved?.();
    },
  });
}
