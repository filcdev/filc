import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType } from 'hono/client';
import { type InferResponseType, parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type UsersResponse = NonNullable<
  InferResponseType<typeof api.users.index.$get>['data']
>;

export type User = UsersResponse['users'][number];

type RolesResponse = NonNullable<
  InferResponseType<typeof api.roles.index.$get>['data']
>;

export type Role = RolesResponse['roles'][number];

type Cohort = NonNullable<
  InferResponseType<typeof api.cohort.index.$get>['data']
>[number];

type UserApi = typeof api.users;

type UpdateUserPayload = InferRequestType<UserApi[':id']['$patch']>['json'];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Page size shared by the admin users page and its query. */
export const USERS_PAGE_SIZE = 20;

/** Paged user list for the admin users page. */
export function useUsers(page: number, search: string) {
  return useQuery({
    queryFn: async (): Promise<UsersResponse> => {
      const res = await parseResponse(
        api.users.index.$get({
          query: {
            limit: USERS_PAGE_SIZE.toString(),
            offset: ((page - 1) * USERS_PAGE_SIZE).toString(),
            search,
          },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load users');
      }
      return res.data as UsersResponse;
    },
    queryKey: queryKeys.users(page, search),
  });
}

/** Full role list with permissions. */
export function useRoles() {
  return useQuery({
    queryFn: async (): Promise<RolesResponse> => {
      const res = await parseResponse(api.roles.index.$get());
      if (!res.success) {
        throw new Error('Failed to load roles');
      }
      return res.data as RolesResponse;
    },
    queryKey: queryKeys.roles(),
  });
}

/** Known permission strings for role editing. */
export function usePermissions() {
  return useQuery({
    queryFn: async (): Promise<string[]> => {
      const res = await parseResponse(api.roles.permissions.$get());
      if (!res.success) {
        throw new Error('Failed to load permissions');
      }
      return (res.data?.permissions ?? []) as string[];
    },
    queryKey: queryKeys.permissions(),
  });
}

/** Cohort list for user pickers. */
export function useCohorts() {
  return useQuery({
    queryFn: async (): Promise<Cohort[]> => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return (res.data ?? []) as Cohort[];
    },
    queryKey: queryKeys.cohorts(),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.usersAll() });
}

function useInvalidateRoles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.roles() });
}

/** Update a user's nickname, cohort and roles. */
export function useUpdateUser({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateUsers();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: UpdateUserPayload & { id: string }) => {
      const res = await api.users[':id'].$patch({
        json: {
          ...payload,
          nickname: payload.nickname || undefined,
        },
        param: { id },
      });
      if (!res.ok) {
        throw new Error(t('users.updateError'));
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('users.updateError'));
    },
    onSuccess: () => {
      toast.success(t('users.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create a role with an initial permission set. */
export function useCreateRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      name,
      permissions: perms,
    }: {
      name: string;
      permissions: string[];
    }) => {
      const res = await api.roles.index.$post({
        json: { name, permissions: perms },
      });
      if (!res.ok) {
        throw new Error('Failed to create role');
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('roles.createError'));
    },
    onSuccess: () => {
      toast.success(t('roles.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update the permission set of an existing role. */
export function useUpdateRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      name,
      permissions: perms,
    }: {
      name: string;
      permissions: string[];
    }) => {
      const res = await api.roles[':name'].$patch({
        json: { permissions: perms },
        param: { name },
      });
      if (!res.ok) {
        throw new Error('Failed to update role');
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('roles.updateError'));
    },
    onSuccess: () => {
      toast.success(t('roles.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a role by name. */
export function useDeleteRole({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateRoles();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.roles[':name'].$delete({ param: { name } });
      if (!res.ok) {
        throw new Error('Failed to delete role');
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('roles.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('roles.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
