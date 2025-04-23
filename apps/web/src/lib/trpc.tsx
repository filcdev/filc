import type { AppRouter } from '@filc/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from '@tanstack/react-router'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import superjson from 'superjson'

const { TRPCProvider: TrpcBaseProvider, useTRPC } =
  createTRPCContext<AppRouter>()

const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

const getQueryClient = () => {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

const TrpcProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          // TODO: make this dynamic
          url: 'http://localhost:3000/api/trpc',
          transformer: superjson,
          fetch: (input, init) => {
            return fetch(input, {
              ...init,
              credentials: 'include',
            })
          },
        }),
      ],
    })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TrpcBaseProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TrpcBaseProvider>
    </QueryClientProvider>
  )
}

export { TrpcProvider, useTRPC, getQueryClient }
