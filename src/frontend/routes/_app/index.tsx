import { createFileRoute } from '@tanstack/react-router';
import { TimetableView } from '~/frontend/components/timetable-view';

export const Route = createFileRoute('/_app/')({
  component: App,
});

function App() {
  return <TimetableView />;
}
