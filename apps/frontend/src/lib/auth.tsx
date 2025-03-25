import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import type { User } from '@filc/auth'

import { useTRPC } from './trpc'
import { setToken as setAuthToken } from './trpc/provider'

interface AuthContextType {
  token: string
  refreshToken: string
  user: User | null
  login: (data: { email: string; password: string }) => Promise<void>
  register: (data: { email: string; password: string }) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
  completeOnboarding: (data: {
    username: string
    classId: string
  }) => Promise<void>
  logout: () => void
  getAuthToken: () => string
  refreshAccessToken: () => Promise<boolean>
  isRefreshing: boolean
  // TODO: Add password reset functionality
}

const AuthContext = createContext<AuthContextType>({
  token: '',
  refreshToken: '',
  user: null,
  login: async () => {
    return await Promise.resolve()
  },
  register: async () => {
    return await Promise.resolve()
  },
  verifyEmail: async () => {
    return await Promise.resolve()
  },
  resendVerification: async () => {
    return await Promise.resolve()
  },
  completeOnboarding: async () => {
    return await Promise.resolve()
  },
  logout: () => {
    return
  },
  getAuthToken: () => {
    return ''
  },
  refreshAccessToken: async () => {
    await Promise.resolve()
    return false
  },
  isRefreshing: true
})

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const trpc = useTRPC()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('site-token') ?? '')
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem('site-refresh-token') ?? ''
  )
  const [isRefreshing, setIsRefreshing] = useState(true)

  const loginQuery = useMutation(trpc.auth.login.mutationOptions())
  const registerQuery = useMutation(trpc.auth.register.mutationOptions())
  const verifyEmailQuery = useMutation(trpc.auth.verifyEmail.mutationOptions())
  const resendVerificationQuery = useMutation(
    trpc.auth.resendVerification.mutationOptions()
  )
  const completeOnboardingQuery = useMutation(
    trpc.auth.completeOnboarding.mutationOptions()
  )
  const getSessionQuery = useQuery(trpc.auth.getSession.queryOptions())
  const refreshTokenQuery = useMutation(trpc.auth.refresh.mutationOptions())

  const login = async (data: { email: string; password: string }) => {
    const res = await loginQuery.mutateAsync(data)

    setUser(res.user)
    setToken(res.token)
    setRefreshToken(res.refreshToken)
    localStorage.setItem('site-token', res.token)
    localStorage.setItem('site-refresh-token', res.refreshToken)
    return
  }

  const register = async (data: { email: string; password: string }) => {
    const res = await registerQuery.mutateAsync(data)
    setUser(res.user)

    return
  }

  const verifyEmail = async (token: string) => {
    const res = await verifyEmailQuery.mutateAsync({ token })
    setUser(res.user)
    return
  }

  const resendVerification = async (email: string) => {
    await resendVerificationQuery.mutateAsync({ email })
    return
  }

  const completeOnboarding = async (data: {
    username: string
    classId: string
  }) => {
    const res = await completeOnboardingQuery.mutateAsync(data)
    setUser(res.user)
    setToken(res.token)
    setRefreshToken(res.refreshToken)
    localStorage.setItem('site-token', res.token)
    localStorage.setItem('site-refresh-token', res.refreshToken)
    return
  }

  const logout = useCallback(() => {
    setUser(null)
    setToken('')
    setRefreshToken('')
    setAuthToken('')
    loginQuery.reset()
    registerQuery.reset()
    localStorage.removeItem('site-token')
    localStorage.removeItem('site-refresh-token')
  }, [loginQuery, registerQuery])

  const getAuthToken = () => {
    return token
  }

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (!refreshToken || isRefreshing) return false

    try {
      setIsRefreshing(true)
      const result = await refreshTokenQuery.mutateAsync({ refreshToken })
      setToken(result.token)
      setRefreshToken(result.refreshToken)
      localStorage.setItem('site-token', result.token)
      localStorage.setItem('site-refresh-token', result.refreshToken)

      // Refetch user data with new token
      await getSessionQuery.refetch()
      return true
    } catch (error) {
      console.error('Error refreshing token:', error)
      // Clear token and session on refresh error
      logout()
      return false
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshToken, refreshTokenQuery, getSessionQuery, logout, isRefreshing])

  // On initial load and token changes, get user session
  useEffect(() => {
    async function refetchUser() {
      if (token && !user) {
        try {
          const result = await getSessionQuery.refetch()
          if (result.data?.user) {
            setUser(result.data.user)
          } else {
            // Try to refresh the token if session is invalid
            await refreshAccessToken()
          }
        } catch (error) {
          console.error('Error fetching user session:', error)
          // Try to refresh the token if there's an error (possibly expired token)
          await refreshAccessToken()
        }
      }
    }
    refetchUser()
      .catch((err) => {
        console.error('Error in refetchUser:', err)
      })
      .finally(() => setIsRefreshing(false))
  }, [token, user, getSessionQuery, refreshAccessToken])

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  // Add event listener for token refresh events
  useEffect(() => {
    const handleTokenRefresh = () => {
      refreshAccessToken().catch((err) => {
        console.error('Error during token refresh:', err)
      })
    }

    window.addEventListener('token:refresh', handleTokenRefresh)

    return () => {
      window.removeEventListener('token:refresh', handleTokenRefresh)
    }
  }, [refreshToken, refreshAccessToken])

  return (
    <AuthContext.Provider
      value={{
        token,
        refreshToken,
        user,
        login,
        register,
        verifyEmail,
        resendVerification,
        completeOnboarding,
        logout,
        getAuthToken,
        refreshAccessToken,
        isRefreshing
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider

export const useAuth = () => {
  return useContext(AuthContext)
}
