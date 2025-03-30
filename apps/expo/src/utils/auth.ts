import { useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { trpc } from './api'
import { deleteToken, setToken } from './session-store'

export const useUser = () => {
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions())
  return session?.user ?? null
}

export const useSignIn = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const signIn = useMutation(trpc.auth.login.mutationOptions())

  return async (email: string, password: string) => {
    const res = await signIn.mutateAsync({ email, password })
    setToken(res.token)

    await queryClient.invalidateQueries(trpc.pathFilter())
    router.replace('/')
  }
}

export const useSignOut = () => {
  const queryClient = useQueryClient()
  const signOut = useMutation(trpc.auth.logout.mutationOptions())
  const router = useRouter()

  return async () => {
    const res = await signOut.mutateAsync()
    if (!res.success) return
    await deleteToken()
    await queryClient.invalidateQueries(trpc.pathFilter())
    router.replace('/')
  }
}
