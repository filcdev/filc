import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_private/admin/timetable/import')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/timetable/manage' });
  },
});
