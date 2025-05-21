import { AuthProvider } from '@/lib/auth'
import { ConfigProvider } from '@/lib/config'
import { Sentry } from '@/lib/sentry'
import { TrpcProvider } from '@/lib/trpc'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@filc/ui/components/sonner'

const RootLayout = () => {
  return (
    <ConfigProvider>
      <AuthProvider>
        <TrpcProvider>
          <Outlet />
          <TanStackRouterDevtools />
          <Sentry />
          <Toaster richColors />
        </TrpcProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
