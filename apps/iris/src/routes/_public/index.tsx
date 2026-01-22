import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TimetableView } from '@/components/timetable-view';

export const searchSchema = z.object({
  cohortClass: z.string().optional(),
  cohortClassroom: z.string().optional(),
  cohortTeacher: z.string().optional(),
});

export const Route = createFileRoute('/_public/')({
  component: App,
  validateSearch: (search) => searchSchema.parse(search),
});

function App() {
  return <TimetableView />;
}
