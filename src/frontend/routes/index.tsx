import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  return (
    <div className="text-center">
      <header className="flex min-h-screen flex-col items-center justify-center bg-[#282c34] text-[calc(10px+2vmin)] text-white">
        <h1 className="mb-6 font-bold text-4xl">Welcome to TanStack + Hono</h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed">
          Edit{' '}
          <code className="rounded bg-gray-800 px-2 py-1">
            src/routes/index.tsx
          </code>{' '}
          and save to reload. Built with{' '}
          <span className="font-semibold text-[#61dafb]">TanStack Router</span>{' '}
          and <span className="font-semibold text-[#61dafb]">Hono</span> for
          blazing-fast server-side rendering.
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          <a
            className="text-[#61dafb] transition-colors hover:text-white hover:underline"
            href="https://reactjs.org"
            rel="noopener noreferrer"
            target="_blank"
          >
            Learn React
          </a>
          <a
            className="text-[#61dafb] transition-colors hover:text-white hover:underline"
            href="https://tanstack.com/router"
            rel="noopener noreferrer"
            target="_blank"
          >
            Learn TanStack Router
          </a>
          <a
            className="text-[#61dafb] transition-colors hover:text-white hover:underline"
            href="https://hono.dev"
            rel="noopener noreferrer"
            target="_blank"
          >
            Learn Hono
          </a>
        </div>
      </header>
    </div>
  );
}
