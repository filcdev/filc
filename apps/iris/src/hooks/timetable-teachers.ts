import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, orpc } from '@/utils/orpc';

type TeachersAdminResponse = Awaited<
  ReturnType<typeof api.timetable.teachers.list>
>;

/** A teacher as returned by the admin list (email + linked user included). */
export type AdminTeacher = TeachersAdminResponse[number];

type UserOptionsResponse = Awaited<ReturnType<typeof api.users.list>>;

/** A user available for the teacher assignment picker. */
export type TeacherUserOption = UserOptionsResponse['users'][number];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Admin teacher list (email + linked user); gated by `teacher:manage`. */
export function useTeachersAdmin() {
  return useQuery(orpc.timetable.teachers.list.queryOptions());
}

/**
 * Users for the teacher assignment picker. The list endpoint caps `limit` at
 * 100 and returns `total`, so the first page sizes every remaining offset and
 * the rest are fetched in one fan-out instead of a chain of round trips; a
 * failed fetch falls back to an empty list so the combobox stays usable.
 */
export function useTeacherUserOptions() {
  return useQuery({
    queryFn: async (): Promise<TeacherUserOption[]> => {
      try {
        const pageSize = 100;
        const first = await api.users.list({ limit: pageSize, offset: 0 });
        if (first.users.length < pageSize || first.total <= pageSize) {
          return first.users;
        }

        const offsets: number[] = [];
        for (let offset = pageSize; offset < first.total; offset += pageSize) {
          offsets.push(offset);
        }

        const pages = await Promise.all(
          offsets.map((offset) => api.users.list({ limit: pageSize, offset }))
        );

        return [first, ...pages].flatMap((page) => page.users);
      } catch {
        return [];
      }
    },
    // The picker pages the whole user list itself, so it needs its own key
    // rather than the paged admin list's; it still sits under the teachers
    // router so a broad timetable invalidation reaches it.
    queryKey: [...orpc.timetable.teachers.key(), 'user-options'],
  });
}

/** Update a teacher's email and/or linked user. */
export function useUpdateTeacher({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.teachers.update.mutationOptions({
      onError: () => {
        toast.error(t('teachers.updateError'));
      },
      onSuccess: () => {
        toast.success(t('teachers.updateSuccess'));
        queryClient.invalidateQueries({
          queryKey: orpc.timetable.teachers.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.timetable.teachers.me.key(),
        });
        onSaved?.();
      },
    })
  );
}
