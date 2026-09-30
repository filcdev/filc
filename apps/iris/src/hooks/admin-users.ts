import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { sortCohorts } from '@/utils/cohort';
import { api, orpc } from '@/utils/orpc';

type UsersResponse = Awaited<ReturnType<typeof api.users.list>>;

export type User = UsersResponse['users'][number];

type RolesResponse = Awaited<ReturnType<typeof api.roles.list>>;

export type Role = RolesResponse['roles'][number];

type Cohort = Awaited<ReturnType<typeof api.cohort.cohort>>[number];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Page size shared by the admin users page and its query. */
export const USERS_PAGE_SIZE = 20;

/** Paged user list for the admin users page. */
export function useUsers(page: number, search: string) {
  return useQuery(
    orpc.users.list.queryOptions({
      input: {
        limit: USERS_PAGE_SIZE,
        offset: (page - 1) * USERS_PAGE_SIZE,
        search,
      },
    })
  );
}

/** Full role list with permissions. */
export function useRoles() {
  return useQuery(orpc.roles.list.queryOptions());
}

/** Known permission strings for role editing. */
export function usePermissions() {
  return useQuery({
    ...orpc.roles.permissions.queryOptions(),
    select: (payload) => payload.permissions,
  });
}

/** Cohort list for user pickers. */
export function useCohorts() {
  return useQuery({
    ...orpc.cohort.cohort.queryOptions(),
    select: sortCohorts as (cohorts: Cohort[]) => Cohort[],
  });
}

/** Kept in sync by every role write: the list is the only cached role view. */
function useInvalidateRoles() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.roles.list.key() });
}

/** Update a user's nickname, cohort and roles. */
export function useUpdateUser({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.users.update>[0]) =>
      // An empty nickname means "leave it alone", not "clear it".
      api.users.update({ ...input, nickname: input.nickname || undefined }),
    onError: () => {
      toast.error(t('users.updateError'));
    },
    onSuccess: () => {
      toast.success(t('users.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
      onSaved?.();
    },
  });
}

/** Create a role with an initial permission set. */
export function useCreateRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation(
    orpc.roles.create.mutationOptions({
      onError: () => {
        toast.error(t('roles.createError'));
      },
      onSuccess: () => {
        toast.success(t('roles.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update the permission set of an existing role. */
export function useUpdateRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation(
    orpc.roles.update.mutationOptions({
      onError: () => {
        toast.error(t('roles.updateError'));
      },
      onSuccess: () => {
        toast.success(t('roles.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete a role by name. */
export function useDeleteRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation(
    orpc.roles.delete.mutationOptions({
      onError: () => {
        toast.error(t('roles.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('roles.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}
