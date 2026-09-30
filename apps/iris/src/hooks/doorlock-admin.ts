import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, orpc } from '@/utils/orpc';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

type DevicesData = Awaited<ReturnType<typeof api.doorlock.devices.list>>;
type CardsData = Awaited<ReturnType<typeof api.doorlock.cards.list>>;
type LogsData = Awaited<ReturnType<typeof api.doorlock.logs.list>>;
type UsersData = Awaited<ReturnType<typeof api.doorlock.cards.users>>;
type StatsOverviewData = Awaited<
  ReturnType<typeof api.doorlock.stats.overview>
>;

export type DoorlockDevice = DevicesData['devices'][number];
export type DoorlockCard = CardsData['cards'][number];
export type DoorlockLogEntry = LogsData['logs'][number];
export type DoorlockUser = UsersData['users'][number];
export type DoorlockStatsOverview = StatsOverviewData['stats'];

type DeviceStats = Awaited<ReturnType<typeof api.doorlock.devices.stats>>;
export type DeviceStat = DeviceStats[number];

type SelfCardsData = Awaited<ReturnType<typeof api.doorlock.self.cards.list>>;
/** A card owned by the signed-in user. */
export type SelfCard = SelfCardsData['cards'][number];

export type CardPayload = Parameters<typeof api.doorlock.cards.create>[0];
export type DevicePayload = Parameters<typeof api.doorlock.devices.create>[0];

/** All registered doorlock devices. */
export function useDoorlockDevices({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.doorlock.devices.list.queryOptions(), enabled });
}

/** All admin-visible access cards. */
export function useDoorlockCards({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.doorlock.cards.list.queryOptions(), enabled });
}

/** Access cards belonging to the signed-in user. */
export function useSelfCards() {
  return useQuery(orpc.doorlock.self.cards.list.queryOptions());
}

/** Freeze or unfreeze one of the signed-in user's cards. */
export function useFreezeSelfCard({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.doorlock.self.cards.setFrozen.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('doorlock.selfCards.freezeError'));
      },
      onSuccess: (_res, variables) => {
        queryClient.invalidateQueries({
          queryKey: orpc.doorlock.self.cards.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.doorlock.cards.list.key(),
        });
        toast.success(
          variables.frozen
            ? t('doorlock.selfCards.freezeSuccess')
            : t('doorlock.selfCards.unfreezeSuccess')
        );
        onSaved?.();
      },
    })
  );
}

/** Activate one of the signed-in user's cards on a reader. */
export function useActivateSelfCard({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.doorlock.self.cards.activate.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('doorlock.selfCards.activateError'));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.doorlock.self.cards.list.key(),
        });
        toast.success(t('doorlock.selfCards.activateSuccess'));
        onSaved?.();
      },
    })
  );
}

/** Card owner candidates; only fetched when enabled. */
export function useCardUsers({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.doorlock.cards.users.queryOptions(), enabled });
}

type DoorlockLogFilters = {
  accessFilter: 'all' | 'granted' | 'denied';
  cardFilter: string;
  dateRange: { from?: Date; to?: Date };
  deviceFilter: string;
  search: string;
  userFilter: string;
};

type DoorlockLogsInput = Parameters<typeof api.doorlock.logs.list>[0];

const buildLogsQuery = ({
  accessFilter,
  cardFilter,
  dateRange,
  deviceFilter,
  search,
  userFilter,
}: DoorlockLogFilters): DoorlockLogsInput => {
  const query: DoorlockLogsInput = { limit: 500 };

  if (deviceFilter !== 'all') {
    query.deviceId = deviceFilter;
  }
  if (cardFilter !== 'all') {
    query.cardId = cardFilter;
  }
  if (userFilter !== 'all') {
    query.userId = userFilter;
  }
  if (accessFilter === 'granted') {
    query.granted = 'true';
  } else if (accessFilter === 'denied') {
    query.granted = 'false';
  }
  if (dateRange.from) {
    query.from = dateRange.from.toISOString();
  }
  if (dateRange.to) {
    query.to = dateRange.to.toISOString();
  }
  if (search) {
    query.search = search;
  }

  return query;
};

/** Access logs for the given filters; results stay fresh for 30 seconds. */
export function useDoorlockLogs(filters: DoorlockLogFilters) {
  return useQuery({
    ...orpc.doorlock.logs.list.queryOptions({ input: buildLogsQuery(filters) }),
    staleTime: 30_000,
  });
}

/** Dashboard overview stats. */
export function useDoorlockStatsOverview() {
  return useQuery(orpc.doorlock.stats.overview.queryOptions());
}

/** Per-device hardware stats; polled every 30s while the dialog is open. */
export function useDoorlockDeviceStats(deviceId: string | null, open: boolean) {
  return useQuery({
    ...orpc.doorlock.devices.stats.queryOptions({
      input: { id: deviceId ?? '' },
    }),
    enabled: !!deviceId && open,
    refetchInterval: 30_000, // Refresh every 30s
  });
}

/** Every card write moves the card list and the overview counters. */
function useInvalidateCardsAndStats() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.doorlock.cards.list.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.doorlock.stats.overview.key(),
    });
  };
}

/** Create or update a card from the cards admin page. */
export function useUpsertDoorlockCard({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateCardsAndStats();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: CardPayload;
    }) =>
      id
        ? api.doorlock.cards.update({ ...payload, id })
        : api.doorlock.cards.create(payload),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('doorlockCards.updateSuccess')
          : t('doorlockCards.createSuccess')
      );
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a card by id. */
export function useDeleteDoorlockCard() {
  const invalidate = useInvalidateCardsAndStats();
  const { t } = useTranslation();
  return useMutation(
    orpc.doorlock.cards.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('doorlockCards.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('doorlockCards.deleteSuccess'));
        invalidate();
      },
    })
  );
}

/** Create or update a card from the logs page ("add card" action). */
export function useUpsertCardFromLog({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCardsAndStats();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: CardPayload;
    }) =>
      id
        ? api.doorlock.cards.update({ ...payload, id })
        : api.doorlock.cards.create(payload),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.saveError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockCards.saveSuccess'));
      queryClient.invalidateQueries({
        queryKey: orpc.doorlock.logs.list.key(),
      });
      invalidate();
      onSaved?.();
    },
  });
}

/** Create or update a device. */
export function useUpsertDoorlockDevice({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: DevicePayload;
    }) =>
      id
        ? api.doorlock.devices.update({ ...payload, id })
        : api.doorlock.devices.create(payload),
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockDevices.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('doorlockDevices.updateSuccess')
          : t('doorlockDevices.createSuccess')
      );
      queryClient.invalidateQueries({
        queryKey: orpc.doorlock.devices.list.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.doorlock.stats.overview.key(),
      });
      onSaved?.();
    },
  });
}

/** Delete a device by id. */
export function useDeleteDoorlockDevice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.doorlock.devices.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('doorlockDevices.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('doorlockDevices.deleteSuccess'));
        queryClient.invalidateQueries({
          queryKey: orpc.doorlock.devices.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.doorlock.stats.overview.key(),
        });
      },
    })
  );
}

/** Trigger an OTA firmware update on one device or all devices. */
export function useUpdateDeviceFirmware({ onSaved }: MutationCallbacks = {}) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      deviceId,
      url,
    }: {
      deviceId?: string;
      url: string;
    }) => {
      if (deviceId) {
        return await api.doorlock.devices.triggerOta({ id: deviceId, url });
      }
      return await api.doorlock.devices.updateAll({ url });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockDevices.saveError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockDevices.updateSuccess'));
      onSaved?.();
    },
  });
}
