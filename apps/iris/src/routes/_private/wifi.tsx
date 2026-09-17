import { ApiError } from '@filcdev/api/errors';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Input } from '@filcdev/ui/components/input';
import { PasswordInput } from '@filcdev/ui/components/password-input';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertCircle, ArrowLeft, Download, Edit2, Wifi, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/navbar';
import { RelativeTime } from '@/components/wifi/relative-time';
import {
  useCreateWifiAccount,
  useDownloadWifiCertificate,
  useUpdateWifiDevice,
  useUpdateWifiPassword,
  useWifiSelf,
  useWifiStatus,
} from '@/hooks/wifi';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private/wifi')({
  component: WifiPage,
});

function WifiPage() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  const statusQuery = useWifiStatus();
  const selfQuery = useWifiSelf(
    Boolean(session?.session) && statusQuery.data?.enabled === true
  );

  const state = getWifiPageState({ selfQuery, session, statusQuery });

  if (state.kind === 'hidden') {
    return null;
  }

  if (state.kind === 'error') {
    return <WifiStatusErrorMessage t={t} />;
  }

  if (state.kind === 'loading') {
    return <WifiLoadingState />;
  }

  return (
    <>
      <Navbar showLogo={true} />
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Link
          className="flex w-max items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted/50"
          to="/"
        >
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Link>

        <WifiHeader t={t} />
        {state.isLoading && <WifiLoadingState />}
        {!state.isLoading && state.account ? (
          <>
            {state.account.banned && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t('wifi.accountBannedTitle')}</AlertTitle>
                <AlertDescription>
                  {t('wifi.accountBannedDescription')}
                </AlertDescription>
              </Alert>
            )}
            {!state.account.banned &&
              state.account.devices.some((d) => d.banned) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>{t('wifi.deviceBannedTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('wifi.deviceBannedDescription')}
                  </AlertDescription>
                </Alert>
              )}
            <AccountSummary account={state.account} ssid={state.ssid} t={t} />
            <PasswordChangeForm t={t} />
            <CertificateDownload t={t} />
            <DeviceList account={state.account} t={t} />
          </>
        ) : null}
        {!(state.isLoading || state.account) && (
          <SetupLater
            email={session?.user?.email || 'unknown@example.com'}
            ssid={state.ssid}
            t={t}
          />
        )}
      </div>
    </>
  );
}

function getWifiPageState({
  selfQuery,
  session,
  statusQuery,
}: {
  selfQuery: ReturnType<typeof useWifiSelf>;
  session: ReturnType<typeof authClient.useSession>['data'];
  statusQuery: ReturnType<typeof useWifiStatus>;
}) {
  const status = statusQuery.data;
  const wifiAccountMissing =
    selfQuery.isError &&
    selfQuery.error instanceof ApiError &&
    selfQuery.error.status === 404;
  const account = wifiAccountMissing ? null : (selfQuery.data?.wifi ?? null);

  if (statusQuery.isError) {
    return {
      account: null,
      isLoading: false,
      kind: 'error',
      ssid: 'Filc WiFi',
    };
  }

  if (statusQuery.isLoading) {
    return {
      account: null,
      isLoading: true,
      kind: 'loading',
      ssid: 'Filc WiFi',
    };
  }

  if (status && !status.enabled) {
    return {
      account: null,
      isLoading: false,
      kind: 'hidden',
      ssid: status.ssid || 'Filc WiFi',
    };
  }

  if (selfQuery.isError && !wifiAccountMissing) {
    return {
      account: null,
      isLoading: false,
      kind: 'error',
      ssid: status?.ssid || 'Filc WiFi',
    };
  }

  const isLoading =
    statusQuery.isLoading ||
    (Boolean(session?.session) &&
      status?.enabled === true &&
      selfQuery.isLoading);

  return {
    account,
    isLoading,
    kind: 'content',
    ssid: status?.ssid || 'Filc WiFi',
  };
}

function WifiLoadingState() {
  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function WifiStatusErrorMessage({ t }: { t: (key: string) => string }) {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>{t('wifi.unavailable')}</AlertTitle>
        <AlertDescription>{t('wifi.loadError')}</AlertDescription>
      </Alert>
    </div>
  );
}

function WifiHeader({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-3">
      <Wifi className="size-6 text-primary" />
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {t('wifi.title')}
        </h1>
        <p className="text-muted-foreground">{t('wifi.description')}</p>
      </div>
    </div>
  );
}

function SetupLater({
  email,
  ssid,
  t,
}: {
  email: string;
  ssid: string;
  t: (key: string) => string;
}) {
  const createMutation = useCreateWifiAccount();
  const [passwordError, setPasswordError] = useState<string>('');

  const form = useForm({
    defaultValues: {
      confirmPassword: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        setPasswordError(t('wifi.passwordMismatch'));
        return;
      }
      setPasswordError('');
      await createMutation.mutateAsync(value.password);
      form.reset();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('wifi.createAccount')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">
              {t('wifi.username')}
            </p>
            <p className="font-medium">{email}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {t('wifi.networkName')}
            </p>
            <p className="font-medium">{ssid}</p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>{t('wifi.passwordSecurityWarning')}</AlertTitle>
          <AlertDescription>
            {t('wifi.passwordSecurityWarningDescription')}
          </AlertDescription>
        </Alert>

        {passwordError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{passwordError}</AlertDescription>
          </Alert>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                if (!value) {
                  return t('wifi.passwordRequired');
                }
                if (value.length < 1) {
                  return t('wifi.passwordTooShort');
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label
                  className="font-medium text-sm"
                  htmlFor={`password_${field.name}`}
                >
                  {t('wifi.password')}
                </label>
                <PasswordInput
                  id={`password_${field.name}`}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('wifi.passwordPlaceholder')}
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="confirmPassword"
            validators={{
              onChange: ({ value }) => {
                if (!value) {
                  return t('wifi.passwordRequired');
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label
                  className="font-medium text-sm"
                  htmlFor={`confirmPassword_${field.name}`}
                >
                  {t('wifi.confirmPassword')}
                </label>
                <PasswordInput
                  id={`confirmPassword_${field.name}`}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('wifi.confirmPasswordPlaceholder')}
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <Button
            className="w-full"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              t('wifi.createAccount')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountSummary({
  account,
  ssid,
  t,
}: {
  account: NonNullable<ReturnType<typeof useWifiSelf>['data']>['wifi'];
  ssid: string;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{t('wifi.account')}</CardTitle>
            <Badge variant={account.banned ? 'destructive' : 'secondary'}>
              {account.banned ? t('wifi.blocked') : t('wifi.active')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">
                {t('wifi.username')}
              </p>
              <p className="font-medium">{account.username}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">
                {t('wifi.networkName')}
              </p>
              <p className="font-medium">{ssid}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('wifi.speedLimit')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">
              {t('wifi.download')}
            </p>
            <p className="font-semibold text-lg">
              {account.speedLimit.downloadSpeedMbps ?? t('wifi.unlimited')}
              {account.speedLimit.downloadSpeedMbps ? ' Mbps' : ''}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{t('wifi.upload')}</p>
            <p className="font-semibold text-lg">
              {account.speedLimit.uploadSpeedMbps ?? t('wifi.unlimited')}
              {account.speedLimit.uploadSpeedMbps ? ' Mbps' : ''}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{t('wifi.source')}</p>
            <p className="font-medium">
              {account.speedLimit.roleName
                ? `${account.speedLimit.source} · ${account.speedLimit.roleName}`
                : t(`wifi.${account.speedLimit.source}`)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceList({
  account,
  t,
}: {
  account: NonNullable<ReturnType<typeof useWifiSelf>['data']>['wifi'];
  t: (key: string) => string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('wifi.devices')}</CardTitle>
          <Badge variant="outline">{account.devices.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {account.devices.length === 0 ? (
          <p className="text-muted-foreground">{t('wifi.noDevices')}</p>
        ) : (
          account.devices.map((device) => (
            <DeviceItem
              device={device}
              isEditing={editingId === device.id}
              key={device.id}
              onEditEnd={() => setEditingId(null)}
              onEditStart={() => setEditingId(device.id)}
              t={t}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy rendering logic
function DeviceItem({
  device,
  isEditing,
  onEditStart,
  onEditEnd,
  t,
}: {
  device: NonNullable<
    ReturnType<typeof useWifiSelf>['data']
  >['wifi']['devices'][0];
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  t: (key: string) => string;
}) {
  const updateMutation = useUpdateWifiDevice();
  const [tempNickname, setTempNickname] = useState(device.nickname);

  const handleSave = async () => {
    if (tempNickname !== device.nickname) {
      await updateMutation.mutateAsync({
        deviceId: device.id,
        nickname: tempNickname,
      });
    }
    onEditEnd();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center md:justify-between">
      {isEditing ? (
        <div className="flex-1">
          <Input
            disabled={updateMutation.isPending}
            onChange={(e) => setTempNickname(e.target.value || null)}
            placeholder={device.reportedHostname || device.macAddress}
            value={tempNickname || ''}
          />
        </div>
      ) : (
        <div>
          <p className="font-medium">
            {device.nickname || device.reportedHostname || device.macAddress}
          </p>
          <p className="text-muted-foreground text-sm">
            {device.reportedHostname &&
            device.reportedHostname !== device.nickname
              ? device.reportedHostname
              : device.macAddress}
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {device.nickname &&
              device.reportedHostname &&
              device.nickname !== device.reportedHostname && (
                <>
                  <span>{device.reportedHostname}</span>
                  <span>&bull;</span>
                </>
              )}
            <span className="font-mono text-xs uppercase">
              {device.macAddress
                .replace(/[^0-9a-fA-F]/g, '')
                .match(/.{1,2}/g)
                ?.join(':') ?? device.macAddress}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button
              disabled={updateMutation.isPending}
              onClick={handleSave}
              size="sm"
              variant="default"
            >
              {updateMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                t('common.save')
              )}
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => {
                setTempNickname(device.nickname);
                onEditEnd();
              }}
              size="sm"
              variant="outline"
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {device.banned ? (
                <Badge variant="destructive">{t('wifi.blocked')}</Badge>
              ) : (
                <Badge variant="outline">{t('wifi.active')}</Badge>
              )}
              <span>
                {device.lastActiveAt ? (
                  <RelativeTime date={device.lastActiveAt} />
                ) : (
                  t('wifi.never')
                )}
              </span>
            </div>
            {!device.banned && (
              <Button
                onClick={onEditStart}
                size="sm"
                title={t('wifi.editDevice')}
                variant="ghost"
              >
                <Edit2 className="size-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PasswordChangeForm({ t }: { t: (key: string) => string }) {
  const updateMutation = useUpdateWifiPassword();
  const [showForm, setShowForm] = useState(false);
  const [passwordError, setPasswordError] = useState<string>('');

  const form = useForm({
    defaultValues: {
      confirmPassword: '',
      newPassword: '',
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmPassword) {
        setPasswordError(t('wifi.passwordMismatch'));
        return;
      }
      setPasswordError('');
      await updateMutation.mutateAsync(value.newPassword);
      setShowForm(false);
      form.reset();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('wifi.changePassword')}</CardTitle>
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              variant="outline"
            >
              {t('wifi.updatePassword')}
            </Button>
          )}
        </div>
      </CardHeader>
      {showForm && (
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>{t('wifi.passwordChangeWarning')}</AlertTitle>
            <AlertDescription>
              {t('wifi.passwordChangeWarningDescription')}
            </AlertDescription>
          </Alert>
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>{t('wifi.passwordSecurityWarning')}</AlertTitle>
            <AlertDescription>
              {t('wifi.passwordSecurityWarningDescription')}
            </AlertDescription>
          </Alert>
          {passwordError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Field
              name="newPassword"
              validators={{
                onChange: ({ value }) => {
                  if (!value) {
                    return t('wifi.passwordRequired');
                  }
                  if (value.length < 1) {
                    return t('wifi.passwordTooShort');
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor={`newPassword_${field.name}`}
                  >
                    {t('wifi.newPassword')}
                  </label>
                  <PasswordInput
                    id={`newPassword_${field.name}`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('wifi.newPasswordPlaceholder')}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field
              name="confirmPassword"
              validators={{
                onChange: ({ value }) => {
                  if (!value) {
                    return t('wifi.passwordRequired');
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor={`confirmPassword_${field.name}`}
                  >
                    {t('wifi.confirmPassword')}
                  </label>
                  <PasswordInput
                    id={`confirmPassword_${field.name}`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('wifi.confirmPasswordPlaceholder')}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  t('common.save')
                )}
              </Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={() => {
                  setShowForm(false);
                  setPasswordError('');
                  form.reset();
                }}
                type="button"
                variant="outline"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

function CertificateDownload({ t }: { t: (key: string) => string }) {
  const downloadMutation = useDownloadWifiCertificate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('wifi.certificate')}</CardTitle>
          <Button
            disabled={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate()}
            size="sm"
            variant="outline"
          >
            <Download className="mr-2 size-4" />
            {downloadMutation.isPending
              ? t('wifi.downloading')
              : t('wifi.downloadCertificate')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          {t('wifi.certificateDescription')}
        </p>
      </CardContent>
    </Card>
  );
}
