import { AuthProvider } from '@/lib/auth'
import { ConfigProvider } from '@/lib/config'
import { Sentry } from '@/lib/sentry'
import { TrpcProvider } from '@/lib/trpc'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const RootLayout = () => {
  return (
    <ConfigProvider>
      <AuthProvider>
        <TrpcProvider>
          <Outlet />
          <TanStackRouterDevtools />
          <Sentry />
        </TrpcProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
