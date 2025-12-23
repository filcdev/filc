import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { InferResponseType } from 'hono/client';
import { Ban, DoorOpen, IdCard, MapPin, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { api } from '@/utils/hc';

dayjs.extend(relativeTime);

type CardsResponse = InferResponseType<typeof api.doorlock.self.cards.$get>;

type DoorlockSelfCard = NonNullable<CardsResponse['data']>['cards'][number];

type UserCardListProps = {
  cards: DoorlockSelfCard[];
  isUpdatingId?: string | null;
  onToggleFreeze: (card: DoorlockSelfCard) => void;
};

export function UserCardList({
  cards,
  isUpdatingId,
  onToggleFreeze,
}: UserCardListProps) {
  if (!cards.length) {
    return (
      <p className="text-center text-muted-foreground">
        You do not have any cards yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const deviceNames = card.authorizedDevices
          .map((device) => device.name)
          .join(', ');
        const isUpdating = isUpdatingId === card.id;

        return (
          <Card
            className={!card.enabled || card.frozen ? 'bg-muted/40' : undefined}
            key={card.id}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard />
                <span>{card.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <MapPin />
                <span>{deviceNames || 'No authorized devices'}</span>
              </div>
              <div className="flex items-center gap-2">
                <DoorOpen />
                <span>Updated {dayjs(card.updatedAt).fromNow()}</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-end gap-3">
              {!card.enabled && (
                <span className="flex items-center gap-1 font-semibold text-destructive">
                  <Ban /> Disabled
                </span>
              )}
              <Button
                className="gap-2"
                disabled={!card.enabled || isUpdating}
                onClick={() => onToggleFreeze(card)}
                variant="outline"
              >
                <Snowflake />
                <span>{card.frozen ? 'Unfreeze card' : 'Freeze card'}</span>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
