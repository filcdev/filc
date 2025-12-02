import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useEffect, useState } from 'react';
import { UsersTable } from '@/components/admin/users-table';
import { Input } from '@/components/ui/input';
import { api } from '@/utils/hc';

export const Route = createFileRoute('/_private/admin/users')({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const usersQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(
        api.users.index.$get({
          query: {
            limit: limit.toString(),
            offset: ((page - 1) * limit).toString(),
            search: debouncedSearch,
          },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load users');
      }
      return res.data;
    },
    queryKey: ['users', page, debouncedSearch],
  });

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-bold text-2xl">User Management</h1>
      <div className="flex max-w-sm items-center justify-between">
        <Input
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search users..."
          type="text"
          value={search}
        />
      </div>
      {(() => {
        if (usersQuery.isLoading) {
          return <p>Loading...</p>;
        }
        if (usersQuery.isError) {
          return <p className="text-red-500">Error loading users</p>;
        }
        if (!usersQuery.data) {
          return <p>No data</p>;
        }
        return (
          <UsersTable
            limit={limit}
            onPageChange={setPage}
            page={page}
            total={usersQuery.data.total}
            users={usersQuery.data.users}
          />
        );
      })()}
    </div>
  );
}
