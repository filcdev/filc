import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'

import type { AppRouter } from '@filc/api'

import { getBaseUrl } from './base-url'
import { getToken } from './session-store'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {}
  }
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
        colorMode: 'ansi'
      }),
      httpBatchLink({
        transformer: superjson,
        url: getBaseUrl(),
        headers() {
          const headers = new Map<string, string>()
          headers.set('x-trpc-source', 'expo-react')

          const token = getToken()
          if (token) headers.set('x-filc-authtok', token)

          return Object.fromEntries(headers)
        }
      })
    ]
  }),
  queryClient
})

export { type RouterInputs, type RouterOutputs } from '@filc/api'
