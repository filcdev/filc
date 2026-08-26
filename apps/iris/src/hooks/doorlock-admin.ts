import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

type DevicesData = NonNullable<
  InferResponseType<typeof api.doorlock.devices.$get>['data']
>;
type CardsData = NonNullable<
  InferResponseType<typeof api.doorlock.cards.$get>['data']
>;
type LogsData = NonNullable<
  InferResponseType<typeof api.doorlock.logs.$get>['data']
>;
type UsersData = NonNullable<
  InferResponseType<typeof api.doorlock.cards.users.$get>['data']
>;
type StatsOverviewData = NonNullable<
  InferResponseType<typeof api.doorlock.stats.overview.$get>['data']
>;

export type DoorlockDevice = DevicesData['devices'][number];
export type DoorlockCard = CardsData['cards'][number];
export type DoorlockLogEntry = LogsData['logs'][number];
export type DoorlockUser = UsersData['users'][number];
export type DoorlockStatsOverview = StatsOverviewData['stats'];

type DeviceStatsResponse = InferResponseType<
  (typeof api.doorlock.devices)[':id']['stats']['$get']
>;
export type DeviceStat = NonNullable<DeviceStatsResponse['data']>[number];

export type CardPayload = InferRequestType<
  typeof api.doorlock.cards.$post
>['json'];
export type DevicePayload = InferRequestType<
  typeof api.doorlock.devices.$post
>['json'];

/** All registered doorlock devices. */
export function useDoorlockDevices({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<DevicesData> => {
      const res = await parseResponse(api.doorlock.devices.$get());
      if (!res.success) {
        throw new Error('Failed to load devices');
      }
      return res.data as DevicesData;
    },
    queryKey: queryKeys.doorlock.devices(),
  });
}

/** All admin-visible access cards. */
export function useDoorlockCards({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<CardsData> => {
      const res = await parseResponse(api.doorlock.cards.$get());
      if (!res.success) {
        throw new Error('Failed to load cards');
      }
      return res.data as CardsData;
    },
    queryKey: queryKeys.doorlock.cards(),
  });
}

/** Card owner candidates; only fetched when enabled. */
export function useCardUsers({ enabled }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<UsersData> => {
      const res = await parseResponse(api.doorlock.cards.users.$get());
      if (!res.success) {
        throw new Error('Failed to load card users');
      }
      return res.data as UsersData;
    },
    queryKey: queryKeys.doorlock.cardUsers(),
  });
}

type DoorlockLogFilters = {
  accessFilter: 'all' | 'granted' | 'denied';
  cardFilter: string;
  dateRange: { from?: Date; to?: Date };
  deviceFilter: string;
  search: string;
  userFilter: string;
};

const buildLogsQuery = ({
  accessFilter,
  cardFilter,
  dateRange,
  deviceFilter,
  search,
  userFilter,
}: DoorlockLogFilters) => {
  const query: Record<string, string> = { limit: '500' };

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
  const query = buildLogsQuery(filters);
  return useQuery({
    queryFn: async (): Promise<LogsData> => {
      const res = await parseResponse(api.doorlock.logs.$get({ query }));
      if (!res.success) {
        throw new Error('Failed to load logs');
      }
      return res.data as LogsData;
    },
    queryKey: queryKeys.doorlock.logs({
      accessFilter: filters.accessFilter,
      cardFilter: filters.cardFilter,
      dateFrom: filters.dateRange.from?.toISOString() ?? 'none',
      dateTo: filters.dateRange.to?.toISOString() ?? 'none',
      deviceFilter: filters.deviceFilter,
      search: filters.search,
      userFilter: filters.userFilter,
    }),
    staleTime: 30_000,
  });
}

/** Dashboard overview stats. */
export function useDoorlockStatsOverview() {
  return useQuery({
    queryFn: async (): Promise<StatsOverviewData> => {
      const res = await parseResponse(api.doorlock.stats.overview.$get());
      if (!res.success) {
        throw new Error('Failed to load stats overview');
      }
      return res.data as StatsOverviewData;
    },
    queryKey: queryKeys.doorlock.stats(),
  });
}

/** Per-device hardware stats; polled every 30s while the dialog is open. */
export function useDoorlockDeviceStats(deviceId: string | null, open: boolean) {
  return useQuery({
    enabled: !!deviceId && open,
    queryFn: async (): Promise<DeviceStat[]> => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const id = deviceId!;
      const res = await parseResponse(
        api.doorlock.devices[':id'].stats.$get({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to load device statistics');
      }
      return res.data as DeviceStat[];
    },
    queryKey: queryKeys.doorlock.deviceStats(deviceId ?? ''),
    refetchInterval: 30_000, // Refresh every 30s
  });
}

function useInvalidate(queryKeyToInvalidate: readonly unknown[]) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
}

/** Create or update a card from the cards admin page. */
export function useUpsertDoorlockCard({ onSaved }: MutationCallbacks = {}) {
  const invalidateCards = useInvalidate(queryKeys.doorlock.cards());
  const invalidateStats = useInvalidate(queryKeys.doorlock.stats());
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: CardPayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.doorlock.cards[':id'].$put({ json: payload, param: { id } })
          : api.doorlock.cards.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save card');
      }
      return res;
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
      invalidateCards();
      invalidateStats();
      onSaved?.();
    },
  });
}

/** Delete a card by id. */
export function useDeleteDoorlockCard() {
  const invalidateCards = useInvalidate(queryKeys.doorlock.cards());
  const invalidateStats = useInvalidate(queryKeys.doorlock.stats());
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.doorlock.cards[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete card');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockCards.deleteSuccess'));
      invalidateCards();
      invalidateStats();
    },
  });
}

/** Create or update a card from the logs page ("add card" action). */
export function useUpsertCardFromLog({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const invalidateLogs = useInvalidate(['doorlock', 'logs']);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: CardPayload;
    }) => {
      const res = await parseResponse(
        id
          ? api.doorlock.cards[':id'].$put({ json: payload, param: { id } })
          : api.doorlock.cards.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save card');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockCards.saveError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockCards.saveSuccess'));
      invalidateLogs();
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.stats() });
      onSaved?.();
    },
  });
}

/** Create or update a device. */
export function useUpsertDoorlockDevice({ onSaved }: MutationCallbacks = {}) {
  const invalidateDevices = useInvalidate(queryKeys.doorlock.devices());
  const invalidateStats = useInvalidate(queryKeys.doorlock.stats());
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: DevicePayload;
    }) => {
      const res = id
        ? await parseResponse(
            api.doorlock.devices[':id'].$put({
              json: payload,
              param: { id },
            })
          )
        : await parseResponse(api.doorlock.devices.$post({ json: payload }));
      if (!res.success) {
        throw new Error('Failed to save device');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockDevices.saveError'));
    },
    onSuccess: (_res, variables) => {
      toast.success(
        variables.id
          ? t('doorlockDevices.updateSuccess')
          : t('doorlockDevices.createSuccess')
      );
      invalidateDevices();
      invalidateStats();
      onSaved?.();
    },
  });
}

/** Delete a device by id. */
export function useDeleteDoorlockDevice() {
  const invalidateDevices = useInvalidate(queryKeys.doorlock.devices());
  const invalidateStats = useInvalidate(queryKeys.doorlock.stats());
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.doorlock.devices[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete device');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('doorlockDevices.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('doorlockDevices.deleteSuccess'));
      invalidateDevices();
      invalidateStats();
    },
  });
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
      const res = await parseResponse(
        deviceId
          ? api.doorlock.devices[':id'].update.$post({
              json: { url },
              param: { id: deviceId },
            })
          : api.doorlock.devices.update.$post({ json: { url } })
      );
      if (!res.success) {
        throw new Error('Failed to start firmware update');
      }
      return res;
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
