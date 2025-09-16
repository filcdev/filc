import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/error')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/auth/error"!</div>
}
