import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useKioskHeartbeat } from '@/hooks/kiosk';
import { kioskSearchSchema } from '@/routes/_kiosk/route';

export const Route = createFileRoute('/_kiosk/')({
  component: KioskIndex,
  validateSearch: kioskSearchSchema,
});

/** Sends the box to the page its kind is enrolled for. */
function KioskIndex() {
  const { machine } = Route.useSearch();
  const heartbeat = useKioskHeartbeat(machine);

  if (heartbeat?.state === 'navigator') {
    return <Navigate replace search={{ machine }} to="/navigator" />;
  }

  if (heartbeat?.state === 'tv') {
    return <Navigate replace search={{ machine }} to="/tv" />;
  }

  return null;
}
