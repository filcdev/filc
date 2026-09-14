import type { DepartureGroup } from '@filcdev/api/domains/kiosk/config';
import { BusDeparture } from '@/components/tv/bus-departure';
import { useKioskDepartures } from '@/hooks/tv';

type DepartureContainerProps = {
  /** The kiosk's configured stop groups, in display order. */
  groups: DepartureGroup[];
};

/** The departure cards: one per configured group, in configuration order. */
export function DepartureContainer({ groups }: DepartureContainerProps) {
  const { data, isError, isLoading } = useKioskDepartures(groups);

  return (
    <>
      {groups.map((group, index) => (
        <BusDeparture
          departure={data?.departures[index] ?? null}
          displayName={group.label}
          isError={isError}
          isLoading={isLoading}
          key={`${group.label}-${group.stops[0]?.stopId ?? ''}`}
        />
      ))}
    </>
  );
}
