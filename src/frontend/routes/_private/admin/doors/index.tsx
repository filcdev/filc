import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { FaDoorOpen, FaSpinner } from 'react-icons/fa6';
import { toast } from 'sonner';
import { Badge } from '~/frontend/components/ui/badge';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import { authClient } from '~/frontend/utils/authentication';
import { apiClient } from '~/frontend/utils/hc';

export const Route = createFileRoute('/_private/admin/doors/')({
  component: RouteComponent,
});

const fetchDevices = async () => {
  const res = await parseResponse(apiClient.doorlock.devices.$get());
  if (!res?.success) {
    throw new Error('Failed to fetch devices');
  }
  return res.data ?? [];
};

const fetchDeviceStatus = async (deviceId: string) => {
  const res = await parseResponse(
    apiClient.doorlock.devices[':id'].status.$get({
      param: { id: deviceId },
    })
  );
  if (!res?.success) {
    throw new Error('Failed to fetch device status');
  }
  return res.data;
};

const fetchCards = async () => {
  const res = await parseResponse(apiClient.doorlock.cards.$get());
  if (!res?.success) {
    throw new Error('Failed to fetch cards');
  }
  return res.data ?? [];
};

const fetchDeviceRestrictions = async (deviceId: string) => {
  const res = await parseResponse(
    apiClient.doorlock.devices[':id'].cards.$get({
      param: { id: deviceId },
    })
  );
  if (!res?.success) {
    throw new Error('Failed to fetch device restrictions');
  }
  return res.data ?? [];
};

type Device = Awaited<ReturnType<typeof fetchDevices>>[number];
type DeviceStatus = Awaited<ReturnType<typeof fetchDeviceStatus>>;
type CardDevice = Awaited<ReturnType<typeof fetchDeviceRestrictions>>[number];

type DeviceCardProps = {
  device: Device;
  status?: DeviceStatus;
  isOpening: boolean;
  onOpen: () => void;
};

function DeviceCard({ device, status, isOpening, onOpen }: DeviceCardProps) {
  const { t } = useTranslation();
  const isOnline = status?.online ?? false;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{device.name}</CardTitle>
            {device.location && (
              <CardDescription className="mt-1">
                {device.location}
              </CardDescription>
            )}
          </div>
          <Badge
            className={
              isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'
            }
            variant={isOnline ? 'default' : 'secondary'}
          >
            {isOnline ? t('doorlock.online') : t('doorlock.offline')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <Button
          className="w-full"
          disabled={!isOnline || isOpening}
          onClick={onOpen}
          size="lg"
        >
          {isOpening ? (
            <>
              <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
              {t('doorlock.opening')}
            </>
          ) : (
            <>
              <FaDoorOpen className="mr-2 h-4 w-4" />
              {t('doorlock.openDoor')}
            </>
          )}
        </Button>
        {status?.lastSeenAt && (
          <p className="mt-2 text-center text-muted-foreground text-xs">
            {t('doorlock.lastSeen')}:{' '}
            {new Date(status.lastSeenAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  // Fetch all devices
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryFn: fetchDevices,
    queryKey: ['devices'],
  });

  // Fetch user's cards
  const { data: cardsData, isLoading: cardsLoading } = useQuery({
    queryFn: fetchCards,
    queryKey: ['cards'],
  });

  // Fetch device statuses
  const { data: statusesData } = useQuery({
    enabled: !!devicesData && devicesData.length > 0,
    queryFn: async () => {
      if (!devicesData) {
        return {};
      }
      const entries = await Promise.all(
        devicesData.map(async (device) => {
          try {
            const status = await fetchDeviceStatus(device.id);
            return [device.id, status] as const;
          } catch {
            return null;
          }
        })
      );
      return Object.fromEntries(
        entries.filter(
          (entry): entry is [string, DeviceStatus] => entry !== null
        )
      );
    },
    queryKey: ['device-statuses'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch all card-device restrictions
  const { data: restrictionsData } = useQuery({
    enabled: !!devicesData && devicesData.length > 0,
    queryFn: async () => {
      if (!devicesData) {
        return {};
      }
      const entries = await Promise.all(
        devicesData.map(async (device) => {
          try {
            const restriction = await fetchDeviceRestrictions(device.id);
            return [device.id, restriction] as const;
          } catch {
            return null;
          }
        })
      );
      return Object.fromEntries(
        entries.filter(
          (entry): entry is [string, CardDevice[]] => entry !== null
        )
      );
    },
    queryKey: ['card-restrictions'],
  });

  // Open door mutation
  const openDoorMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await parseResponse(
        apiClient.doorlock[':deviceId'].open.$post({
          param: { deviceId },
        })
      );
      if (!res?.success) {
        throw new Error('Failed to open door');
      }
      return res.data;
    },
    onError: () => {
      toast.error(t('doorlock.errorOpening'));
    },
    onSuccess: (_, deviceId) => {
      const device = devicesData?.find((d) => d.id === deviceId);
      toast.success(
        t('doorlock.saveSuccess', { item: device?.name || deviceId })
      );
      queryClient.invalidateQueries({ queryKey: ['device-statuses'] });
    },
  });

  // Helper function to check device access
  const hasDeviceAccess = (device: Device): boolean => {
    if (!cardsData) {
      return false;
    }
    if (!session?.user) {
      return false;
    }

    // Check if user has direct permission
    if (session.user.permissions.includes(`door:${device.id}:open`)) {
      return true;
    }

    // Check if user has a valid card for this device
    const userCards = cardsData.filter(
      (card) =>
        card.userId === session.user.id && !card.frozen && !card.disabled
    );

    for (const card of userCards) {
      const deviceRestrictions = restrictionsData?.[device.id] || [];

      // If no restrictions exist for this device, all cards work
      if (deviceRestrictions.length === 0) {
        return true;
      }

      // Check if this card is in the restrictions list
      if (deviceRestrictions.some((r) => r.cardId === card.id)) {
        return true;
      }
    }

    return false;
  };

  // Filter devices user has access to
  const accessibleDevices = devicesData?.filter(hasDeviceAccess);

  const isLoading = devicesLoading || cardsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-4">
        <FaSpinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('doorlock.myDoors')}
          </h1>
          <p className="text-muted-foreground">{t('doorlock.title')}</p>
        </div>
        {session?.user?.permissions.includes('doorlock:logs:read') && (
          <Link to="/admin/doors/logs">
            <Button variant="outline">{t('doorlock.viewLogs')}</Button>
          </Link>
        )}
      </div>

      {!accessibleDevices || accessibleDevices.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              {t('doorlock.noDevicesAccess')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accessibleDevices.map((device) => (
            <DeviceCard
              device={device}
              isOpening={openDoorMutation.isPending}
              key={device.id}
              onOpen={() => openDoorMutation.mutate(device.id)}
              status={statusesData?.[device.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
