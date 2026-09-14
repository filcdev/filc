import { Badge } from '@filcdev/ui/components/badge';
import { Bus } from 'lucide-react';
import type { ReactNode } from 'react';
import { TV_STRINGS } from '@/components/tv/strings';
import { dayjs } from '@/utils/dayjs';

/** The fields of one departure card, straight from the Chronos proxy. */
export type DepartureInfo = {
  predictedDepartureTime?: number | null;
  routeShortDesc?: string | null;
};

type DepartureCardProps = {
  data: DepartureInfo;
  displayName: string;
};

/**
 * The row shape every state of a group shares: the group's label, then what
 * that group has to show. One line per group is what lets a box configured with
 * the full set of groups fit the rows it is given.
 */
export function DepartureRow({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName: string;
}) {
  return (
    <div className="mx-2 flex items-center justify-between gap-2">
      <h2 className="self-center">{displayName}</h2>
      {children}
    </div>
  );
}

/** One stop group's next vehicle: the countdown plus the route number. */
export function DepartureCard({ data, displayName }: DepartureCardProps) {
  const predicted = data.predictedDepartureTime;

  return (
    <DepartureRow displayName={displayName}>
      <div className="flex gap-1">
        <span className="self-center font-bold text-sm">
          {predicted
            ? dayjs(predicted * 1000).fromNow()
            : TV_STRINGS.departures.unknownRoute}
        </span>
        <Badge className="h-6 gap-1 bg-primary pr-1.5 pl-0 text-primary-foreground">
          {/* Wrapped so the badge's `> svg` sizing rule does not shrink it. */}
          <span className="flex items-center rounded-full bg-primary-foreground p-0.5 text-primary">
            <Bus className="size-4.5" />
          </span>
          <span className="font-bold">
            {data.routeShortDesc || TV_STRINGS.departures.unknownRoute}
          </span>
        </Badge>
      </div>
    </DepartureRow>
  );
}
