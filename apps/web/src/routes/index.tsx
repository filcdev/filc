import { auth } from '@/lib/auth'
import { useTRPC } from '@/lib/trpc'
import { logo } from '@filc/ui'
import { Button } from '@filc/ui/components/button'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

const Index = () => {
  const authData = auth.useSession()
  return authData.data ? <Protected /> : <Public />
}

const Protected = () => {
  const t = useTRPC()
  const authData = auth.useSession()
  const ping = useQuery(
    t.ping.private.queryOptions({
      enabled: !authData.isPending,
    })
  )

  if (ping.isLoading || authData.isPending) {
    return <div>Loading...</div>
  }

  if (ping.isError) {
    return <div>Error: {ping.error.message}</div>
  }

  return (
    <div className='p-2'>
      <h3>Hello from tsr, {authData.data?.user.name}</h3>
      <h4>{ping.data.message}</h4>
      <Button variant='outline' onClick={() => auth.signOut()}>
        Sign out
      </Button>
    </div>
  )
}

const Public = () => {
  const onLogin = async () => {
    const result = await auth.signIn.social({
      provider: 'microsoft',
      callbackURL: `${window.location.origin}`,
    })

    if (result.error) {
      return
    }
  }

  return (
    <div className='p-2'>
      <img src={logo} alt='Filc Logo' className='w-32 h-32' />
      <h3>Welcome to Filc</h3>
      <Button onClick={onLogin}>Login with Microsoft</Button>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
