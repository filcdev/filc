import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import {
  Ban,
  CreditCard,
  Lock,
  Pen,
  Plus,
  RefreshCw,
  Trash,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { StatCard } from '@/components/admin/stat-card';
import { CardDialog } from '@/components/doorlock/card-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { SortIcon } from '@/components/util/sort-icon';
import { useHasPermission } from '@/hooks/use-has-permission';
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type CardsResponse = InferResponseType<typeof api.doorlock.cards.$get>;
type DevicesResponse = InferResponseType<typeof api.doorlock.devices.$get>;
type UsersResponse = InferResponseType<typeof api.doorlock.cards.users.$get>;

type DoorlockCard = NonNullable<CardsResponse['data']>['cards'][number];
type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];
type DoorlockUser = NonNullable<UsersResponse['data']>['users'][number];

export const Route = createFileRoute('/_private/admin/doorlock/cards')({
  component: () => (
    <PermissionGuard permission="doorlock:cards:read">
      <CardsPage />
    </PermissionGuard>
  ),
});

type CardSortColumn = 'name' | 'owner' | 'status' | 'devices' | 'updated';

function getAriaSortState(
  column: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc' | null
): 'ascending' | 'descending' | 'none' {
  if (sortColumn !== column) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

function CardsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<CardSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
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
    queryKey: queryKeys.doorlock.cards(),
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
    queryKey: queryKeys.doorlock.devices(),
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
    queryKey: queryKeys.doorlock.cardUsers(),
  });

  const $upsertCard = api.doorlock.cards.$post;
  const upsertMutation = useMutation<
    InferResponseType<typeof $upsertCard>,
    Error,
    { id?: string; payload: InferRequestType<typeof $upsertCard>['json'] }
  >({
    mutationFn: ({ id, payload }) => {
      if (id) {
        return parseResponse(
          api.doorlock.cards[':id'].$put({ json: payload, param: { id } })
        );
      }
      return parseResponse(api.doorlock.cards.$post({ json: payload }));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('doorlockCards.updateSuccess')
          : t('doorlockCards.createSuccess')
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.stats() });
      setDialogOpen(false);
      setSelectedCard(null);
    },
  });

  const $deleteCard = api.doorlock.cards[':id'].$delete;
  const deleteMutation = useMutation<
    InferResponseType<typeof $deleteCard>,
    Error,
    string
  >({
    mutationFn: async (id: string) =>
      parseResponse(api.doorlock.cards[':id'].$delete({ param: { id } })),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockCards.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.stats() });
    },
  });

  const filteredCards = useMemo(() => {
    const list = cardsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    let filtered = list;

    if (term) {
      filtered = filtered.filter((card) => {
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
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getCardSortValue(a, sortColumn);
        const bValue = getCardSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [cardsQuery.data, search, sortColumn, sortDirection]);

  const totals = useMemo(() => {
    const cards = cardsQuery.data ?? [];
    return {
      disabled: cards.filter((card) => !card.enabled).length,
      frozen: cards.filter((card) => card.frozen).length,
      total: cards.length,
    };
  }, [cardsQuery.data]);

  const handleSave = async (
    payload: InferRequestType<typeof $upsertCard>['json']
  ) => {
    await upsertMutation.mutateAsync({
      ...(selectedCard?.id && { id: selectedCard.id }),
      payload,
    });
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

  const handleSort = (column: CardSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  const isLoading = cardsQuery.isLoading;
  const hasError = cardsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('doorlockCards.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('doorlockCards.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('doorlockCards.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => cardsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('doorlockCards.refresh')}
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedCard(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('doorlockCards.addCard')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<CreditCard className="text-primary" />}
          label={t('doorlockCards.totalCards')}
          value={totals.total}
        />
        <StatCard
          icon={<Lock className="text-primary" />}
          label={t('doorlockCards.frozenCards')}
          value={totals.frozen}
        />
        <StatCard
          icon={<Ban className="text-primary" />}
          label={t('doorlockCards.disabledCards')}
          value={totals.disabled}
        />
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('doorlockCards.loadError')}</AlertTitle>
          <AlertDescription>
            {(cardsQuery.error as Error)?.message ??
              t('doorlockCards.loadError')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  aria-sort={getAriaSortState(
                    'name',
                    sortColumn,
                    sortDirection
                  )}
                  className="select-none"
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('name')}
                    type="button"
                  >
                    {t('doorlockCards.name')}
                    <SortIcon
                      column="name"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead
                  aria-sort={getAriaSortState(
                    'owner',
                    sortColumn,
                    sortDirection
                  )}
                  className="select-none"
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('owner')}
                    type="button"
                  >
                    {t('doorlockCards.owner')}
                    <SortIcon
                      column="owner"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead
                  aria-sort={getAriaSortState(
                    'status',
                    sortColumn,
                    sortDirection
                  )}
                  className="select-none"
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('status')}
                    type="button"
                  >
                    {t('doorlockCards.status')}
                    <SortIcon
                      column="status"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead
                  aria-sort={getAriaSortState(
                    'devices',
                    sortColumn,
                    sortDirection
                  )}
                  className="select-none"
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('devices')}
                    type="button"
                  >
                    {t('doorlockCards.authorizedDevices')}
                    <SortIcon
                      column="devices"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead
                  aria-sort={getAriaSortState(
                    'updated',
                    sortColumn,
                    sortDirection
                  )}
                  className="select-none"
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('updated')}
                    type="button"
                  >
                    {t('doorlockCards.updatedAt')}
                    <SortIcon
                      column="updated"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
                {hasWritePermission && (
                  <TableHead>{t('doorlockCards.actions')}</TableHead>
                )}
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
                      t('doorlockCards.unknownUser')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!card.frozen && card.enabled && (
                        <Badge variant="secondary">
                          {t('doorlockCards.active')}
                        </Badge>
                      )}
                      {card.frozen && (
                        <Badge variant="outline">
                          {t('doorlockCards.frozen')}
                        </Badge>
                      )}
                      {!card.enabled && (
                        <Badge variant="destructive">
                          {t('doorlockCards.disabled')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {card.authorizedDevices.length
                      ? card.authorizedDevices
                          .map((device) => device.name)
                          .join(', ')
                      : t('doorlockCards.noDevices')}
                  </TableCell>
                  <TableCell>
                    {dayjs(card.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                  </TableCell>
                  {hasWritePermission && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={t('doorlockCards.editCard')}
                          onClick={() => {
                            setSelectedCard(card);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={t('doorlockCards.deleteCard')}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(card)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
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
                    {t('doorlockCards.noCardsFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasWritePermission && (
        <CardDialog<DoorlockCard, DoorlockDevice, DoorlockUser>
          card={selectedCard}
          devices={devicesQuery.data ?? []}
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

function getCardSortValue(card: DoorlockCard, column: CardSortColumn) {
  switch (column) {
    case 'name':
      return card.name;
    case 'owner':
      return (
        card.owner?.nickname || card.owner?.name || card.owner?.email || ''
      );
    case 'status':
      if (!card.enabled) {
        return 2;
      }
      return card.frozen ? 1 : 0;
    case 'devices':
      return card.authorizedDevices.map((device) => device.name).join(', ');
    case 'updated':
      return new Date(card.updatedAt).getTime();
    default:
      return '';
  }
}
