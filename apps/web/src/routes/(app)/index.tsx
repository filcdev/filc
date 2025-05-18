import { useAuth } from '@/lib/auth'
import { useTRPC } from '@/lib/trpc'
import { Button } from '@filc/ui/components/button'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

const Index = () => {
  const authData = useAuth().useSession()

  if (authData.isPending) {
    return <div>Loading...</div>
  }

  if (!authData.data) {
    return <div>bro is not logged in</div>
  }

  return (
    <div>
      <span>bro is so logged in</span>
      <Protected />
    </div>
  )
}

const Protected = () => {
  const t = useTRPC()
  const auth = useAuth()
  const authData = auth.useSession()
  const ping = useQuery(
    t.ping.private.queryOptions(undefined, {
      enabled: !!authData.data,
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
      <h4>{ping.data?.message}</h4>
      <Button variant='outline' onClick={() => auth.signOut()}>
        Sign out
      </Button>
    </div>
  )
}

export const Route = createFileRoute('/(app)/')({
  component: Index,
})
