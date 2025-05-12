import { TrpcProvider } from '@/lib/trpc'
import { ConfigProvider } from '@/lib/config'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const RootLayout = () => {
  return (
    <ConfigProvider>
      <TrpcProvider>
        <Outlet />
        <TanStackRouterDevtools />
      </TrpcProvider>
    </ConfigProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
