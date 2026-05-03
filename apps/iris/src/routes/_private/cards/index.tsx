import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import {
  ArrowLeft,
  CreditCard,
  DoorOpen,
  MapPin,
  Shield,
  ShieldOff,
  Snowflake,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type SelfCardsResponse = InferResponseType<typeof api.doorlock.self.cards.$get>;
type SelfCard = NonNullable<SelfCardsResponse['data']>['cards'][number];

export const Route = createFileRoute('/_private/cards/')({
  component: CardsPage,
});

function CardsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activateCard, setActivateCard] = useState<SelfCard | null>(null);

  const {
    data: cards,
    isLoading,
    isError,
  } = useQuery({
    queryFn: async (): Promise<SelfCard[]> => {
      const res = await parseResponse(api.doorlock.self.cards.$get());
      if (!res.success) {
        throw new Error('Failed to load cards');
      }
      return res.data.cards as SelfCard[];
    },
    queryKey: queryKeys.doorlock.selfCards(),
  });

  const freezeMutation = useMutation({
    mutationFn: async ({ id, frozen }: { id: string; frozen: boolean }) =>
      parseResponse(
        api.doorlock.self.cards[':id'].frozen.$put({
          json: { frozen },
          param: { id },
        })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlock.selfCards.freezeError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.frozen
          ? t('doorlock.selfCards.freezeSuccess')
          : t('doorlock.selfCards.unfreezeSuccess')
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.doorlock.selfCards(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.cards() });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({
      cardId,
      deviceId,
    }: {
      cardId: string;
      deviceId: string;
    }) =>
      parseResponse(
        api.doorlock.self.cards[':id'].activate.$post({
          json: { deviceId },
          param: { id: cardId },
        })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlock.selfCards.activateError'));
    },
    onSuccess: () => {
      toast.success(t('doorlock.selfCards.activateSuccess'));
      setActivateCard(null);
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton className="h-52 rounded-2xl" key={`skel-${String(i)}`} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !cards) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <ShieldOff className="size-10" />
        <p>{t('doorlock.selfCards.loadError')}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <CreditCard className="size-10" />
        <p>{t('doorlock.selfCards.noCards')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <Link
        className="flex w-max items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted/50"
        to="/"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <div className="flex items-center gap-3">
        <Shield className="size-6 text-primary" />
        <h1 className="font-semibold text-2xl tracking-tight">
          {t('doorlock.selfCards.title')}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <CardItem
            card={card}
            isFreezing={
              freezeMutation.isPending &&
              freezeMutation.variables?.id === card.id
            }
            key={card.id}
            onActivate={() => setActivateCard(card)}
            onToggleFreeze={() =>
              freezeMutation.mutate({
                frozen: !card.frozen,
                id: card.id,
              })
            }
          />
        ))}
      </div>

      <ActivateDoorDialog
        activatingDeviceId={activateMutation.variables?.deviceId ?? null}
        card={activateCard}
        isActivating={activateMutation.isPending}
        onActivate={(deviceId) => {
          if (!activateCard) {
            return;
          }
          activateMutation.mutate({
            cardId: activateCard.id,
            deviceId,
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setActivateCard(null);
          }
        }}
      />
    </div>
  );
}

function CardItem({
  card,
  isFreezing,
  onActivate,
  onToggleFreeze,
}: {
  card: SelfCard;
  isFreezing: boolean;
  onActivate: () => void;
  onToggleFreeze: () => void;
}) {
  const { t } = useTranslation();
  const isInactive = !card.enabled || card.frozen;
  const deviceNames = card.authorizedDevices.map((d) => d.name);

  const cardBadge = () => {
    if (!card.enabled) {
      return (
        <Badge variant="destructive">
          {t('doorlock.selfCards.statusDisabled')}
        </Badge>
      );
    }
    if (card.frozen) {
      return (
        <Badge variant="secondary">
          {t('doorlock.selfCards.statusFrozen')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">{t('doorlock.selfCards.statusActive')}</Badge>
    );
  };

  return (
    <Card
      className={cn('min-w-sm max-w-lg', {
        'bg-muted/40': isInactive,
      })}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-lg">
            <CreditCard className="size-5 shrink-0" />
            {card.name}
          </span>

          <div className="flex items-center gap-1.5">{cardBadge()}</div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-muted-foreground text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {deviceNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {deviceNames.map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="italic">{t('doorlock.selfCards.noDevices')}</span>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button
          className="gap-2"
          disabled={isInactive}
          onClick={onActivate}
          size="sm"
          variant="default"
        >
          <DoorOpen className="size-4" />
          {t('doorlock.selfCards.openDoor')}
        </Button>
        <Button
          className="gap-2"
          disabled={!card.enabled || isFreezing}
          onClick={onToggleFreeze}
          size="sm"
          variant={card.frozen ? 'default' : 'outline'}
        >
          {isFreezing && <Spinner />}
          {!isFreezing && card.frozen && <Sun className="size-4" />}
          {!(isFreezing || card.frozen) && <Snowflake className="size-4" />}
          {card.frozen
            ? t('doorlock.selfCards.unfreeze')
            : t('doorlock.selfCards.freeze')}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ActivateDoorDialog({
  card,
  isActivating,
  activatingDeviceId,
  onActivate,
  onOpenChange,
}: {
  card: SelfCard | null;
  isActivating: boolean;
  activatingDeviceId: string | null;
  onActivate: (deviceId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const devices = card?.authorizedDevices ?? [];

  return (
    <Dialog onOpenChange={onOpenChange} open={!!card}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="size-5" />
            {t('doorlock.selfCards.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('doorlock.selfCards.dialogDescription', {
              cardName: card?.name ?? '',
            })}
          </DialogDescription>
        </DialogHeader>

        {devices.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            {t('doorlock.selfCards.dialogNoDevices')}
          </p>
        ) : (
          <div className="grid gap-2">
            {devices.map((device) => {
              const isThis = isActivating && activatingDeviceId === device.id;
              return (
                <Button
                  className="h-auto justify-start gap-3 px-4 py-3"
                  disabled={isActivating}
                  key={device.id}
                  onClick={() => onActivate(device.id)}
                  variant="outline"
                >
                  {isThis ? (
                    <Spinner className="size-5" />
                  ) : (
                    <DoorOpen className="size-5 shrink-0" />
                  )}
                  <span className="font-medium text-sm">{device.name}</span>
                </Button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
