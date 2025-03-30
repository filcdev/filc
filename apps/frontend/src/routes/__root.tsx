import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Toaster } from '@/components/ui/sonner'
import AuthProvider from '@/lib/auth'
import TRPCProvider from '@/lib/trpc/provider'

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <AuthProvider>
        <Outlet />
        <TanStackRouterDevtools />
        <Toaster richColors />
      </AuthProvider>
    </TRPCProvider>
  )
})
