import { useTRPC } from '@/lib/trpc'
import { logo } from '@filc/ui'
import { Button } from '@filc/ui/components/button'
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
      <h1 className='text-background'>asd</h1>
      <Button
        onClick={() => {
          ping.refetch()
        }}
        variant='outline'
        className='mb-2'
      >
        Refetch
      </Button>
      <h4>{ping.data}</h4>
    </div>
  )
}
