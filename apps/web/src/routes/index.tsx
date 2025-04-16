import { useTRPC } from '@/lib/trpc'
import { logo } from '@filc/ui'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const t = useTRPC()
  const ping = useQuery(t.ping.queryOptions())

  if (ping.isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className='p-2'>
      <img src={logo} alt='' />
      <h3>Hello from tsr</h3>
      <h4>{ping.data}</h4>
    </div>
  )
}
