import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type GroupsForCohortResponse = InferResponseType<
  (typeof api.timetable.groups.getForCohort)[':cohortId']['$get']
>;

/** A group of a cohort, with the current user's selection flag. */
export type GroupItem = NonNullable<GroupsForCohortResponse['data']>[number];

/** Groups of one cohort, used by the public "pick your group" picker. */
export function useGroupsForCohort(cohortId: string | null | undefined) {
  return useQuery({
    enabled: !!cohortId,
    queryFn: async (): Promise<GroupItem[]> => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const id = cohortId!;
      const res = await parseResponse(
        api.timetable.groups.getForCohort[':cohortId'].$get({
          param: { cohortId: id },
        })
      );
      if (!(res.success && res.data)) {
        throw new Error('Failed to load groups');
      }
      return res.data as GroupItem[];
    },
    queryKey: queryKeys.timetable.groups(cohortId),
  });
}

/**
 * Derives the current user's group selection for a class, plus how split
 * lessons should be shown (`'highlight'` default, `'hide'`, or `'none'` when
 * the group view is not active).
 */
export function useTimetableGroupDisplay(
  cohortId: string | null | undefined,
  active: boolean,
  stored: string | undefined
) {
  const groupsQuery = useGroupsForCohort(active ? cohortId : null);

  let groupDisplay: 'highlight' | 'hide' | 'none' = 'none';
  if (active) {
    groupDisplay = stored === 'hide' ? 'hide' : 'highlight';
  }

  const selectedGroupIds = useMemo(
    () =>
      new Set(
        (groupsQuery.data ?? [])
          .filter((group) => group.selected)
          .map((group) => group.id)
      ),
    [groupsQuery.data]
  );

  const selectedDivisionTags = useMemo(
    () =>
      new Set(
        (groupsQuery.data ?? [])
          .filter((group) => group.selected && group.divisionTag)
          .map((group) => group.divisionTag as string)
      ),
    [groupsQuery.data]
  );

  return { groupDisplay, selectedDivisionTags, selectedGroupIds };
}

/** Select the current user's group for a division (one group per division). */
export function useSelectGroup({ onSaved }: { onSaved?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ groupId }: { groupId: string }) => {
      const res = await parseResponse(
        api.timetable.groups.select.$post({ json: { groupId } })
      );
      if (!res.success) {
        throw new Error('Failed to select group');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.selectGroupError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.selectGroupSuccess'));
      // Selecting a group re-scopes the lessons (per-division filter) and the
      // groups query (selection flags), so invalidate both families.
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
      onSaved?.();
    },
  });
}
