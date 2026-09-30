import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { TimetableView } from '@/components/timetable';
import type { PublicTimetable } from '@/hooks/timetable-public';
import { orpc, prefetch } from '@/utils/orpc';

export const searchSchema = z.object({
  cohort: z.string().optional(),
  room: z.string().optional(),
  teacher: z.string().optional(),
  timetable: z.string().optional(),
  view: z.enum(['grid', 'card']).optional(),
});

export const Route = createFileRoute('/_public/')({
  component: App,
  // Only the timetable-scoped queries need the selected timetable, so the rest
  // ride along with `latestValid` instead of waiting a round trip for it.
  loader: async ({ context, location }) => {
    const { queryClient } = context;
    const [latest] = await Promise.all([
      prefetch(
        queryClient,
        orpc.timetable.timetables.latestValid.queryOptions()
      ),
      prefetch(queryClient, orpc.timetable.timetables.list.queryOptions()),
      prefetch(queryClient, orpc.timetable.teachers.getAll.queryOptions()),
      prefetch(queryClient, orpc.timetable.classrooms.getAll.queryOptions()),
    ]);
    const timetableId =
      new URLSearchParams(location.searchStr).get('timetable') ??
      (latest as PublicTimetable | null)?.id;
    if (timetableId) {
      await Promise.all([
        prefetch(
          queryClient,

          orpc.timetable.cohorts.getAllForTimetable.queryOptions({
            input: { timetableId },
          })
        ),
        prefetch(
          queryClient,

          orpc.timetable.periods.getAll.queryOptions({
            input: { timetableId },
          })
        ),
      ]);
    }
  },
  validateSearch: (search) => searchSchema.parse(search),
});

function App() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.timetable');
  }, [t]);

  return <TimetableView />;
}
