type ScreenProps = {
  machineId: string;
};

/** The identifier chip every enrolment/disabled screen shows. */
function MachineId({ machineId }: ScreenProps) {
  return (
    <code className="rounded-xl bg-background px-6 py-4 font-mono text-3xl tracking-widest md:text-6xl">
      {machineId}
    </code>
  );
}

/**
 * Shown while Chronos does not know this box. Keeps the heartbeat polling, so
 * enrolling it in Iris reaches the box without a restart.
 */
export function EnrolmentScreen({ machineId }: ScreenProps) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-muted p-8 text-center">
      <h1 className="font-bold text-3xl">
        Ez a kijelző még nincs regisztrálva
      </h1>
      <p className="max-w-xl text-lg">
        Vedd fel a Filc admin felületén, a Kijelzők oldalon, az alábbi
        gépazonosítóval.
      </p>
      <MachineId machineId={machineId} />
      <p className="text-muted-foreground text-sm">
        A kijelző félpercenként újrapróbálja.
      </p>
    </div>
  );
}

type DisabledScreenProps = ScreenProps & {
  kioskName: string;
};

/** Shown while the box is enrolled but switched off in Iris. */
export function DisabledScreen({ kioskName, machineId }: DisabledScreenProps) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-muted p-8 text-center">
      <h1 className="font-bold text-3xl">Ez a kijelző le van tiltva</h1>
      <p className="max-w-xl text-lg">{kioskName}</p>
      <MachineId machineId={machineId} />
      <p className="text-muted-foreground text-sm">
        Engedélyezd az Iris admin felületén, és a kijelző magától elindul.
      </p>
    </div>
  );
}
