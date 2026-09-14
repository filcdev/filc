import { createFileRoute, Outlet } from '@tanstack/react-router';
import z from 'zod';
import { DisabledScreen, EnrolmentScreen } from '@/components/kiosk-screens';
import { useKioskHeartbeat } from '@/hooks/kiosk';

/** The box identifies itself in the URL; the on-box launcher puts its DMI
 *  product UUID there. */
export const kioskSearchSchema = z.object({
  machine: z.string().min(1),
});

export const Route = createFileRoute('/_kiosk')({
  component: KioskLayout,
  errorComponent: MissingMachineId,
  validateSearch: kioskSearchSchema,
});

/**
 * Gates every kiosk page on the heartbeat: an unknown box gets the enrolment
 * screen, a disabled one the disabled screen, and both keep polling so Iris
 * changes reach the box without a restart.
 */
function KioskLayout() {
  const { machine } = Route.useSearch();
  const heartbeat = useKioskHeartbeat(machine);

  if (!heartbeat || heartbeat.state === 'unknown') {
    return <EnrolmentScreen machineId={machine} />;
  }

  if (heartbeat.state === 'disabled') {
    return (
      <DisabledScreen kioskName={heartbeat.kiosk.name} machineId={machine} />
    );
  }

  return <Outlet />;
}

/** Reached when the URL carries no machine id at all — a hand-typed URL, never
 *  a box. */
function MissingMachineId() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-bold text-2xl">Hiányzó gépazonosító</h1>
      <p className="max-w-xl">
        A kijelzőt a <code>?machine=&lt;gépazonosító&gt;</code> paraméterrel
        kell megnyitni.
      </p>
    </div>
  );
}
