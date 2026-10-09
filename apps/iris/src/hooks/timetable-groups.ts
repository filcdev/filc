import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

type GroupsForCohortResponse = Awaited<
  ReturnType<typeof api.timetable.groups.getForCohort>
>;

/** A group of a cohort, with the current user's selection flag. */
export type GroupItem = GroupsForCohortResponse[number];

/** Groups of one cohort, used by the public "pick your group" picker. */
export function useGroupsForCohort(cohortId: string | null | undefined) {
  return useQuery({
    ...orpc.timetable.groups.getForCohort.queryOptions({
      // Only ever fetched when the id is known; the empty string keeps the
      // input well-formed while the query is disabled.
      input: { cohortId: cohortId ?? '' },
    }),
    enabled: !!cohortId,
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
  return useMutation(
    orpc.timetable.groups.select.mutationOptions({
      onError: () => {
        toast.error(t('timetable.selectGroupError'));
      },
      onSuccess: () => {
        toast.success(t('timetable.selectGroupSuccess'));
        // Selecting a group re-scopes both the groups query (selection flags)
        // and the lessons (per-division filter); every timetable-derived view
        // lives under one family key.
        queryClient.invalidateQueries({ queryKey: orpc.timetable.key() });
        onSaved?.();
      },
    })
  );
}
