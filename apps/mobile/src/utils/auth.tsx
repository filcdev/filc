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

import { useStronghold } from './store'
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

const stub = (returnType?: any) => {
  return async () => {
    return returnType
  }
}

const AuthContext = createContext<AuthContextType>({
  token: '',
  refreshToken: '',
  user: null,
  login: stub(),
  register: stub(),
  logout: stub(),
  getAuthToken: () => '',
  refreshAccessToken: stub()
})

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const trpc = useTRPC()
  const { getRecord, editRecord, insertRecord, stronghold, client } =
    useStronghold()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
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
      setAuthToken(res.token)
      await editRecord('token', res.token)
      await editRecord('refreshToken', res.refreshToken)
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
      setAuthToken(res.token)
      await editRecord('token', res.token)
      await editRecord('refreshToken', res.refreshToken)
      return
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  const logout = useCallback(async () => {
    setUser(null)
    setToken('')
    setRefreshToken('')
    setAuthToken('')
    loginQuery.reset()
    registerQuery.reset()
    await editRecord('token', '')
    await editRecord('refreshToken', '')
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
      await editRecord('token', result.token)
      await editRecord('refreshToken', result.refreshToken)
      setAuthToken(result.token)

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
    const loadTokens = async () => {
      console.log('Loading tokens from Stronghold')
      const storedToken = await getRecord('token')
      const storedRefreshToken = await getRecord('refreshToken')
      if (!storedToken && !storedRefreshToken) {
        console.warn('No tokens found, setting empty values')
        await insertRecord('token', '')
        await insertRecord('refreshToken', '')
        return
      }
      if (storedToken) {
        setToken(storedToken)
      }
      if (storedRefreshToken) {
        setRefreshToken(storedRefreshToken)
      }
    }

    loadTokens()
      .catch((err) => {
        console.error('Error loading tokens:')
        throw err
      })
      .finally(() => {
        console.log('Tokens loaded successfully', { token, refreshToken })
      })
  }, [client, stronghold])

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
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
