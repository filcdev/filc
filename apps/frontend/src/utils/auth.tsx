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
  register: (data: {
    email: string
    username: string
    password: string
    classId: string
  }) => Promise<void>
  logout: () => void
  getAuthToken: () => string
  refreshAccessToken: () => Promise<boolean>
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
  logout: () => {
    return
  },
  getAuthToken: () => {
    return ''
  },
  refreshAccessToken: async () => {
    await Promise.resolve()
    return false
  }
})

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const trpc = useTRPC()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('site-token') ?? '')
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem('site-refresh-token') ?? ''
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loginQuery = useMutation(trpc.auth.login.mutationOptions())
  const registerQuery = useMutation(trpc.auth.register.mutationOptions())
  const getSessionQuery = useQuery(trpc.auth.getSession.queryOptions())
  const refreshTokenQuery = useMutation(trpc.auth.refresh.mutationOptions())

  const login = async (data: { email: string; password: string }) => {
    try {
      const res = await loginQuery.mutateAsync(data)
      setUser(res.user)
      setToken(res.token)
      setRefreshToken(res.refreshToken)
      localStorage.setItem('site-token', res.token)
      localStorage.setItem('site-refresh-token', res.refreshToken)
      return
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  const register = async (data: {
    email: string
    username: string
    password: string
    classId: string
  }) => {
    try {
      const res = await registerQuery.mutateAsync(data)
      setUser(res.user)
      setToken(res.token)
      setRefreshToken(res.refreshToken)
      localStorage.setItem('site-token', res.token)
      localStorage.setItem('site-refresh-token', res.refreshToken)
      return
    } catch (err) {
      console.error(err)
      throw err
    }
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
      console.error('Failed to refresh token:', error)
      // If refresh fails, log out the user
      logout()
      return false
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshToken, isRefreshing, refreshTokenQuery, getSessionQuery, logout])

  useEffect(() => {
    const storedToken = localStorage.getItem('site-token')
    const storedRefreshToken = localStorage.getItem('site-refresh-token')
    if (storedToken) {
      setToken(storedToken)
    }
    if (storedRefreshToken) {
      setRefreshToken(storedRefreshToken)
    }
  }, [])

  useEffect(() => {
    if (user && !getSessionQuery.isStale) return

    const refetchUser = async () => {
      if (token) {
        try {
          const result = await getSessionQuery.refetch()
          if (result.data && result.data.user) {
            setUser(result.data.user)
          } else {
            // Session might be expired, try to refresh the token
            await refreshAccessToken()
          }
        } catch (error) {
          console.error('Error fetching user session:', error)
          // Try to refresh the token if there's an error (possibly expired token)
          await refreshAccessToken()
        }
      }
    }
    refetchUser().catch((err) => {
      console.error('Error in refetchUser:', err)
    })
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
        logout,
        getAuthToken,
        refreshAccessToken
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
