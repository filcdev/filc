import { createFileRoute } from '@tanstack/react-router';
import { SubstitutionView } from '@/components/subs-view';

// Map this page to /subs
export const Route = createFileRoute('/_public/subs')({
  component: App,
});

function App() {
  return <SubstitutionView />;
}
