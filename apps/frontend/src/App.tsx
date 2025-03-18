import { useTRPC } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'

export default function UserList() {
  const trpc = useTRPC()
  const userQuery = useQuery(trpc.auth.getSession.queryOptions())

  return (
    <div>
      <p>{userQuery.data?.userId}</p>
    </div>
  )
}
