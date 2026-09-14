import { TriangleAlert } from 'lucide-react';
import {
  DepartureCard,
  type DepartureInfo,
  DepartureRow,
} from '@/components/tv/departure-card';
import { Loading, QueryError } from '@/components/tv/query-states';
import { TV_STRINGS } from '@/components/tv/strings';

type BusDepartureProps = {
  /** `null` when no vehicle leaves from any of this group's stops. */
  departure: DepartureInfo | null;
  displayName: string;
  isError: boolean;
  isLoading: boolean;
};

/**
 * Nothing leaves from any of this group's stops. Kept to the size of a normal
 * card's line: the alert and the text are the countdown's own size, so an empty
 * group takes no more room than a group with a bus in it.
 */
function NoDeparture() {
  return (
    <div className="flex items-center gap-1.5">
      <TriangleAlert className="size-4.5 text-destructive" />
      <span className="font-bold text-sm">
        {TV_STRINGS.departures.noDeparture}
      </span>
    </div>
  );
}

/** One configured stop group, in configuration order. */
export function BusDeparture({
  departure,
  displayName,
  isError,
  isLoading,
}: BusDepartureProps) {
  if (isLoading) {
    return (
      <DepartureRow displayName={displayName}>
        <Loading />
      </DepartureRow>
    );
  }

  if (isError) {
    return (
      <DepartureRow displayName={displayName}>
        <QueryError />
      </DepartureRow>
    );
  }

  if (!departure) {
    return (
      <DepartureRow displayName={displayName}>
        <NoDeparture />
      </DepartureRow>
    );
  }

  return <DepartureCard data={departure} displayName={displayName} />;
}
