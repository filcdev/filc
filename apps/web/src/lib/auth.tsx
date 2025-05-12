import {
  ac,
  admin,
  editor,
  root,
  student,
  teacher,
} from '@filc/auth/permissions'
import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type React from 'react'
import { createContext, useContext, useMemo } from 'react'
import { useConfig } from './config'

const AuthContext = createContext<ReturnType<typeof createAuthClient> | null>(
  null
)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const config = useConfig()
  const auth = useMemo(
    () =>
      createAuthClient({
        baseURL: config.frontend.apiUrl,
        basePath: '/auth',
        plugins: [
          adminClient(),
          organizationClient({
            ac,
            roles: {
              root,
              admin,
              editor,
              teacher,
              student,
            },
          }),
        ],
      }),
    [config.frontend.apiUrl]
  )

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
