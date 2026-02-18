import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { TimetableView } from '@/components/timetable';

export const searchSchema = z.object({
  cohort: z.string().optional(),
  room: z.string().optional(),
  teacher: z.string().optional(),
});

export const Route = createFileRoute('/_public/')({
  component: App,
  validateSearch: (search) => searchSchema.parse(search),
});

function App() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.timetable');
  }, [t]);

  return <TimetableView />;
}
