import { TrpcProvider } from '@/lib/trpc'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const RootLayout = () => {
  return (
    <TrpcProvider>
      <Outlet />
      <TanStackRouterDevtools />
    </TrpcProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
