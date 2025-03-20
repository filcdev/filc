import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { setToken as setAuthToken } from './trpc/provider'

import type { User } from '@filc/auth'

import { useTRPC } from './trpc'

interface AuthContextType {
  token: string
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
}

const AuthContext = createContext<AuthContextType>({
  token: '',
  user: null,
  login: async () => {return await Promise.resolve()},
  register: async () => {return await Promise.resolve()},
  logout: () => {return},
  getAuthToken: () => {return ''}
});

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const trpc = useTRPC()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('site') ?? '')
  const loginQuery = useMutation(trpc.auth.login.mutationOptions())
  const registerQuery = useMutation(trpc.auth.register.mutationOptions())
  const getSessionQuery = useQuery(trpc.auth.getSession.queryOptions())

  useEffect(() => {
    const storedToken = localStorage.getItem('site')
    if (storedToken) {
      console.log('Token found in localStorage:', storedToken)
      setToken(storedToken)
    }
  }, [getSessionQuery.data])

  useEffect(() => {
    const refetchUser = async () => {
      console.log('Refetching user session...')
      if (token) {
        await getSessionQuery.refetch()
        console.log('Refetched user session:', getSessionQuery.data)
        if (getSessionQuery.data) {
          console.log('User session:', getSessionQuery.data)
          setUser(getSessionQuery.data.user)
        }
      }
    }
    refetchUser().catch((err) => {
      console.error('Error fetching user session:', err)
    });
  }, [token])

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  const login = async (data: { email: string; password: string }) => {
    try {
      const res = await loginQuery.mutateAsync(data)
      setUser(res.user)
      setToken(res.token)
      localStorage.setItem('site', res.token)
      return
    } catch (err) {
      console.error(err)
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
      localStorage.setItem('site', res.token)
      return
    } catch (err) {
      console.error(err)
    }
  }

  const logout = () => {
    setUser(null)
    setToken('')
    localStorage.removeItem('site')
  }

  const getAuthToken = () => {
    return 'Bearer asdadssd'
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, getAuthToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider

export const useAuth = () => {
  return useContext(AuthContext)
}
