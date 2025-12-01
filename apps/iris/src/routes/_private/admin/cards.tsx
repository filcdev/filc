import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { type InferResponseType, parseResponse } from 'hono/client';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  FaBan,
  FaCreditCard,
  FaLock,
  FaPen,
  FaPlus,
  FaTrash,
} from 'react-icons/fa6';
import { toast } from 'sonner';
import { CardDialog } from '@/components/doorlock/card-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';

type CardsResponse = InferResponseType<typeof api.doorlock.cards.$get>;
type DevicesResponse = InferResponseType<typeof api.doorlock.devices.$get>;
type UsersResponse = InferResponseType<typeof api.doorlock.cards.users.$get>;

type DoorlockCard = NonNullable<CardsResponse['data']>['cards'][number];
type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];
type DoorlockUser = NonNullable<UsersResponse['data']>['users'][number];

export const Route = createFileRoute('/_private/admin/cards')({
  component: () => (
    <PermissionGuard permission="doorlock:cards:read">
      <CardsPage />
    </PermissionGuard>
  ),
});

type CardPayload = {
  authorizedDeviceIds: string[];
  cardData?: string;
  enabled: boolean;
  frozen: boolean;
  name: string;
  userId: string;
};

function CardsPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DoorlockCard | null>(null);

  const hasWritePermission = useHasPermission(
    'doorlock:cards:write',
    session?.user?.permissions
  );
  const hasDeviceReadPermission = useHasPermission(
    'doorlock:devices:read',
    session?.user?.permissions
  );

  const cardsQuery = useQuery({
    queryFn: async (): Promise<DoorlockCard[]> => {
      const res = await parseResponse(api.doorlock.cards.$get());
      if (!(res.success && res.data?.cards)) {
        throw new Error('Failed to load cards');
      }
      return res.data.cards as DoorlockCard[];
    },
    queryKey: ['doorlock', 'cards'],
  });

  const devicesQuery = useQuery({
    enabled: hasDeviceReadPermission && hasWritePermission,
    queryFn: async (): Promise<DoorlockDevice[]> => {
      const res = await parseResponse(api.doorlock.devices.$get());
      if (!(res.success && res.data?.devices)) {
        throw new Error('Failed to load devices');
      }
      return res.data.devices as DoorlockDevice[];
    },
    queryKey: ['doorlock', 'devices'],
  });

  const usersQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async (): Promise<DoorlockUser[]> => {
      const res = await parseResponse(api.doorlock.cards.users.$get());
      if (!(res.success && res.data?.users)) {
        throw new Error('Failed to load users');
      }
      return res.data.users as DoorlockUser[];
    },
    queryKey: ['doorlock', 'card-users'],
  });

  const upsertMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: CardPayload }) => {
      if (id) {
        return parseResponse(
          api.doorlock.cards[':id'].$put(
            { param: { id } },
            {
              init: { body: JSON.stringify(payload) },
            }
          )
        );
      }
      return parseResponse(api.doorlock.cards.$post({ json: payload }));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save card');
    },
    onSuccess: (_res, variables) => {
      toast.success(variables.id ? 'Card updated' : 'Card created');
      queryClient.invalidateQueries({ queryKey: ['doorlock', 'cards'] });
      setDialogOpen(false);
      setSelectedCard(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(api.doorlock.cards[':id'].$delete({ param: { id } })),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete card');
    },
    onSuccess: () => {
      toast.success('Card deleted');
      queryClient.invalidateQueries({ queryKey: ['doorlock', 'cards'] });
    },
  });

  const filteredCards = useMemo(() => {
    const list = cardsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return list;
    }
    return list.filter((card) => {
      const ownerLabel = (
        card.owner?.nickname ||
        card.owner?.name ||
        card.owner?.email ||
        ''
      ).toLowerCase();
      return (
        card.name.toLowerCase().includes(term) ||
        ownerLabel.includes(term) ||
        card.authorizedDevices.some((device) =>
          device.name.toLowerCase().includes(term)
        )
      );
    });
  }, [cardsQuery.data, search]);

  const totals = useMemo(() => {
    const cards = cardsQuery.data ?? [];
    return {
      disabled: cards.filter((card) => !card.enabled).length,
      frozen: cards.filter((card) => card.frozen).length,
      total: cards.length,
    };
  }, [cardsQuery.data]);

  const handleSave = async (payload: CardPayload) => {
    await upsertMutation.mutateAsync({ id: selectedCard?.id, payload });
  };

  const handleDelete = async (card: DoorlockCard) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = confirmDestructiveAction(
      `Delete card "${card.name}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(card.id);
  };

  const isLoading = cardsQuery.isLoading;
  const hasError = cardsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search cards..."
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => cardsQuery.refetch()} variant="outline">
            Refresh
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedCard(null);
                setDialogOpen(true);
              }}
            >
              <FaPlus className="mr-2 h-4 w-4" /> Add card
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<FaCreditCard className="text-primary" />}
          label="Total cards"
          value={totals.total}
        />
        <StatCard
          icon={<FaLock className="text-primary" />}
          label="Frozen cards"
          value={totals.frozen}
        />
        <StatCard
          icon={<FaBan className="text-primary" />}
          label="Disabled cards"
          value={totals.disabled}
        />
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load cards</AlertTitle>
          <AlertDescription>
            {(cardsQuery.error as Error)?.message ?? 'Please try again later.'}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Authorized devices</TableHead>
              <TableHead>Updated</TableHead>
              {hasWritePermission && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCards.map((card) => (
              <TableRow key={card.id}>
                <TableCell className="font-medium">{card.name}</TableCell>
                <TableCell>
                  {card.owner?.nickname ||
                    card.owner?.name ||
                    card.owner?.email ||
                    'Unknown user'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!card.frozen && card.enabled && (
                      <Badge variant="secondary">Active</Badge>
                    )}
                    {card.frozen && <Badge variant="outline">Frozen</Badge>}
                    {!card.enabled && (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {card.authorizedDevices.length
                    ? card.authorizedDevices
                        .map((device) => device.name)
                        .join(', ')
                    : 'No devices'}
                </TableCell>
                <TableCell>
                  {dayjs(card.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                </TableCell>
                {hasWritePermission && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedCard(card);
                          setDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <FaPen className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(card)}
                        size="icon"
                        variant="destructive"
                      >
                        <FaTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!(filteredCards.length || hasError) && (
              <TableRow>
                <TableCell
                  className="text-muted-foreground"
                  colSpan={hasWritePermission ? 6 : 5}
                >
                  No cards found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {hasWritePermission && (
        <CardDialog<DoorlockCard, DoorlockDevice, DoorlockUser>
          card={selectedCard}
          devices={devicesQuery.data ?? []}
          isSubmitting={upsertMutation.isPending}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedCard(null);
            }
          }}
          onSubmit={handleSave}
          open={dialogOpen}
          users={usersQuery.data ?? []}
        />
      )}
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
