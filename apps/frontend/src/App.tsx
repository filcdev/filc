import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/utils/trpc';

export default function UserList() {
  const trpc = useTRPC();
  const userQuery = useQuery(trpc.auth.getSession.queryOptions())
  
  return (
    <div>
      <p>{userQuery.data?.userId}</p>
    </div>
  );
}