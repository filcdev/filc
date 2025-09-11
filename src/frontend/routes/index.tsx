import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  return (
    <div className="flex grow flex-col items-center justify-center">
      <h1>Honey i rewrote the filc</h1>
    </div>
  );
}
