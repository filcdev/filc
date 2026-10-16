import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Badge } from '@filcdev/ui/components/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { Ban, CreditCard, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/admin/row-actions';
import { StatCard } from '@/components/admin/stat-card';
import { TableToolbar } from '@/components/admin/table-toolbar';
import { useConfirm } from '@/components/confirm-provider';
import { CardDialog } from '@/components/doorlock/card-dialog';
import { getOwnerLabel } from '@/components/doorlock/doorlock.utils';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type DoorlockCard,
  type DoorlockDevice,
  type DoorlockUser,
  useCardUsers,
  useDeleteDoorlockCard,
  useDoorlockCards,
  useDoorlockDevices,
} from '@/hooks/doorlock-admin';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type UseSortableResult, useSortable } from '@/hooks/use-sortable';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/doorlock/cards')({
  component: () => (
    <PermissionGuard permission={permissions.doorlockCardsRead}>
      <CardsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(context.queryClient, orpc.doorlock.cards.list.queryOptions()),
      prefetch(context.queryClient, orpc.doorlock.cards.users.queryOptions()),
    ]),
});

type CardSortColumn = 'name' | 'owner' | 'status' | 'devices' | 'updated';

function CardsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DoorlockCard | null>(null);

  const hasWritePermission = useHasPermission(
    permissions.doorlockCardsWrite,
    session?.user?.permissions
  );
  const hasDeviceReadPermission = useHasPermission(
    permissions.doorlockDevicesRead,
    session?.user?.permissions
  );

  const cardsQuery = useDoorlockCards();
  const cards: DoorlockCard[] | undefined = cardsQuery.data?.items;

  const devicesQuery = useDoorlockDevices({
    enabled: hasDeviceReadPermission && hasWritePermission,
  });
  const devices: DoorlockDevice[] | undefined = devicesQuery.data?.items;

  const usersQuery = useCardUsers({ enabled: hasWritePermission });
  const users: DoorlockUser[] | undefined = usersQuery.data?.items;

  const deleteMutation = useDeleteDoorlockCard();

  // Filtering stays here; only the ordering is delegated to the hook.
  const filtered = useMemo(() => {
    const list = cards ?? [];
    const term = search.trim().toLowerCase();

    if (!term) {
      return list;
    }

    return list.filter((card) => {
      const ownerLabel = card.owner
        ? getOwnerLabel(card.owner).toLowerCase()
        : '';
      return (
        card.name.toLowerCase().includes(term) ||
        ownerLabel.includes(term) ||
        card.authorizedDevices.some((device) =>
          device.name.toLowerCase().includes(term)
        )
      );
    });
  }, [cards, search]);

  const sort = useSortable(filtered, { getValue: getCardSortValue });
  const filteredCards = sort.rows;

  const totals = useMemo(() => {
    const list = cards ?? [];
    return {
      disabled: list.filter((card) => !card.enabled).length,
      frozen: list.filter((card) => card.frozen).length,
      total: list.length,
    };
  }, [cards]);

  const handleDelete = async (card: DoorlockCard) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = await confirm({
      title: t('doorlockCards.deleteConfirm', { name: card.name }),
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync({ id: card.id });
  };

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

      <TableToolbar
        canCreate={hasWritePermission}
        createLabel={t('doorlockCards.addCard')}
        onCreate={() => {
          setSelectedCard(null);
          setDialogOpen(true);
        }}
        onRefresh={() => cardsQuery.refetch()}
        onSearchChange={setSearch}
        refreshLabel={t('doorlockCards.refresh')}
        search={search}
        searchPlaceholder={t('doorlockCards.searchPlaceholder')}
      />

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

      <QueryBoundary data={cardsQuery.data} query={cardsQuery}>
        {() => (
          <CardsTable
            cards={filteredCards}
            deletePending={deleteMutation.isPending}
            hasError={hasError}
            hasWritePermission={hasWritePermission}
            onDelete={handleDelete}
            onEdit={(card) => {
              setSelectedCard(card);
              setDialogOpen(true);
            }}
            sort={sort}
          />
        )}
      </QueryBoundary>

      {hasWritePermission && (
        <CardDialog<DoorlockCard, DoorlockDevice, DoorlockUser>
          card={selectedCard}
          context="cards"
          devices={devices ?? []}
          key={`${dialogOpen ? 'open' : 'closed'}:${selectedCard?.id ?? 'new'}`}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedCard(null);
            }
          }}
          open={dialogOpen}
          users={users ?? []}
        />
      )}
    </div>
  );
}

const CardsTable = ({
  cards,
  deletePending,
  hasError,
  hasWritePermission,
  onDelete,
  onEdit,
  sort,
}: {
  cards: DoorlockCard[];
  deletePending: boolean;
  hasError: boolean;
  hasWritePermission: boolean;
  onDelete: (card: DoorlockCard) => void;
  onEdit: (card: DoorlockCard) => void;
  sort: UseSortableResult<DoorlockCard, CardSortColumn>;
}) => {
  const { t } = useTranslation();
  const { direction, toggle } = sort;

  const header = (column: CardSortColumn, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggle(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon
          column={column}
          currentColumn={column}
          direction={direction}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            {header('name', 'Name')}
            {header('owner', 'Owner')}
            {header('status', 'Status')}
            {header('devices', 'Authorized devices')}
            {header('updated', 'Updated')}
            {hasWritePermission && (
              <TableHead>{t('doorlockCards.actions')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={card.id}>
              <TableCell className="font-medium">{card.name}</TableCell>
              <TableCell>
                {card.owner
                  ? getOwnerLabel(card.owner) || t('doorlockCards.unknownUser')
                  : t('doorlockCards.unknownUser')}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {!card.frozen && card.enabled && (
                    <Badge variant="secondary">
                      {t('doorlockCards.active')}
                    </Badge>
                  )}
                  {card.frozen && (
                    <Badge variant="outline">{t('doorlockCards.frozen')}</Badge>
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
                  <RowActions
                    deleteLabel={t('doorlockCards.deleteCard')}
                    editLabel={t('doorlockCards.editCard')}
                    isDeleting={deletePending}
                    onDelete={() => onDelete(card)}
                    onEdit={() => onEdit(card)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {!(cards.length || hasError) && (
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
  );
};

function getCardSortValue(card: DoorlockCard, column: CardSortColumn) {
  switch (column) {
    case 'name':
      return card.name;
    case 'owner':
      return card.owner ? getOwnerLabel(card.owner) : '';
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
