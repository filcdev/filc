import { AuthProvider } from '@/lib/auth'
import { ConfigProvider } from '@/lib/config'
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
        </TrpcProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
