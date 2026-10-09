import { useSession } from '@filcdev/auth/client';
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
import { isDefinedError } from '@orpc/client';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertCircle, ArrowLeft, Download, Edit2, Wifi, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/navbar';
import { RelativeTime } from '@/components/util/relative-time';
import {
  useCreateWifiAccount,
  useDownloadWifiCertificate,
  useUpdateWifiDevice,
  useUpdateWifiPassword,
  useWifiSelf,
  useWifiStatus,
  type WifiSelfData,
} from '@/hooks/wifi';
import { orpc, prefetch } from '@/utils/orpc';

const FALLBACK_SSID = 'Filc WiFi';
const PASSWORD_MIN_LENGTH = 8;

export const Route = createFileRoute('/_private/wifi')({
  component: WifiPage,
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.wifi.status.queryOptions()),
});

/** Bans that apply to the whole account or to one of its devices. */
function WifiAccountAlerts({ account }: { account: WifiSelfData }) {
  const { t } = useTranslation();

  if (account.banned) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>{t('wifi.accountBannedTitle')}</AlertTitle>
        <AlertDescription>
          {t('wifi.accountBannedDescription')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!account.devices.some((device) => device.banned)) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{t('wifi.deviceBannedTitle')}</AlertTitle>
      <AlertDescription>{t('wifi.deviceBannedDescription')}</AlertDescription>
    </Alert>
  );
}

/** The state a render should show: the two queries are answered in order. */
type WifiPageState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'hidden' }
  | { account: WifiSelfData | null; hasOtherError: boolean; kind: 'content' };

const getWifiPageState = ({
  selfQuery,
  statusQuery,
}: {
  selfQuery: ReturnType<typeof useWifiSelf>;
  statusQuery: ReturnType<typeof useWifiStatus>;
}): WifiPageState => {
  if (statusQuery.isLoading) {
    return { kind: 'loading' };
  }
  if (statusQuery.isError) {
    return { kind: 'error' };
  }
  if (statusQuery.data?.enabled !== true) {
    return { kind: 'hidden' };
  }

  // A 404 is the "no account yet" state, which renders the setup form.
  const accountMissing =
    selfQuery.isError &&
    isDefinedError(selfQuery.error) &&
    selfQuery.error.code === 'NOT_FOUND';

  return {
    account: accountMissing ? null : (selfQuery.data?.wifi ?? null),
    hasOtherError: selfQuery.isError && !accountMissing,
    kind: 'content',
  };
};

function WifiPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  const statusQuery = useWifiStatus();
  const hasSession = Boolean(session?.session);
  const selfQuery = useWifiSelf(
    hasSession && statusQuery.data?.enabled === true
  );

  const ssid = statusQuery.data?.ssid || FALLBACK_SSID;
  const state = getWifiPageState({ selfQuery, statusQuery });

  if (state.kind === 'hidden') {
    return null;
  }

  if (state.kind === 'loading') {
    return (
      <>
        <Navbar showLogo={true} />
        <WifiLoadingState />
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <Navbar showLogo={true} />
        <div className="container mx-auto max-w-3xl p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t('wifi.unavailable')}</AlertTitle>
            <AlertDescription>{t('wifi.loadError')}</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const { account, hasOtherError } = state;
  const showSetup = !(selfQuery.isLoading || account || hasOtherError);

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

        <div className="flex items-center gap-3">
          <Wifi className="size-6 text-primary" />
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {t('wifi.title')}
            </h1>
            <p className="text-muted-foreground">{t('wifi.description')}</p>
          </div>
        </div>

        {hasOtherError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t('wifi.unavailable')}</AlertTitle>
            <AlertDescription>{t('wifi.loadError')}</AlertDescription>
          </Alert>
        )}

        {selfQuery.isLoading && <WifiLoadingState />}

        {!selfQuery.isLoading && account && (
          <>
            <WifiAccountAlerts account={account} />
            <AccountSummary account={account} ssid={ssid} />
            <PasswordChangeForm />
            <CertificateDownload />
            <DeviceList account={account} />
          </>
        )}

        {showSetup && (
          <SetupAccount email={session?.user?.email ?? ''} ssid={ssid} />
        )}
      </div>
    </>
  );
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

/** Setup form for a signed-in user who has no WiFi account yet. */
function SetupAccount({ email, ssid }: { email: string; ssid: string }) {
  const { t } = useTranslation();
  const createAccount = useCreateWifiAccount();

  const form = useForm({
    defaultValues: { confirmPassword: '', password: '' },
    onSubmit: async ({ value }) => {
      await createAccount.mutateAsync({ password: value.password });
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

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
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
                if (value.length < PASSWORD_MIN_LENGTH) {
                  return t('wifi.passwordTooShort');
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor={field.name}>
                  {t('wifi.password')}
                </label>
                <PasswordInput
                  hidePasswordLabel={t('common.hidePassword')}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t('wifi.passwordPlaceholder')}
                  showPasswordLabel={t('common.showPassword')}
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
              onChange: ({ value, fieldApi }) => {
                if (!value) {
                  return t('wifi.passwordRequired');
                }
                if (value !== fieldApi.form.getFieldValue('password')) {
                  return t('wifi.passwordMismatch');
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor={field.name}>
                  {t('wifi.confirmPassword')}
                </label>
                <PasswordInput
                  hidePasswordLabel={t('common.hidePassword')}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t('wifi.confirmPasswordPlaceholder')}
                  showPasswordLabel={t('common.showPassword')}
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
            disabled={createAccount.isPending}
            type="submit"
          >
            {createAccount.isPending ? (
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
}: {
  account: WifiSelfData;
  ssid: string;
}) {
  const { t } = useTranslation();

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

function DeviceList({ account }: { account: WifiSelfData }) {
  const { t } = useTranslation();
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
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DeviceItem({
  device,
  isEditing,
  onEditStart,
  onEditEnd,
}: {
  device: WifiSelfData['devices'][number];
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const { t } = useTranslation();
  const updateDevice = useUpdateWifiDevice();
  const [nickname, setNickname] = useState(device.nickname);

  const handleSave = async () => {
    if (nickname !== device.nickname) {
      await updateDevice.mutateAsync({ id: device.id, nickname });
    }
    onEditEnd();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center md:justify-between">
      {isEditing ? (
        <div className="flex-1">
          <Input
            disabled={updateDevice.isPending}
            onChange={(event) => setNickname(event.target.value || null)}
            placeholder={device.reportedHostname || device.macAddress}
            value={nickname ?? ''}
          />
        </div>
      ) : (
        <div>
          <p className="font-medium">
            {device.nickname || device.reportedHostname || device.macAddress}
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {device.reportedHostname &&
              device.nickname &&
              device.nickname !== device.reportedHostname && (
                <>
                  <span>{device.reportedHostname}</span>
                  <span>&bull;</span>
                </>
              )}
            <span className="font-mono text-xs uppercase">
              {device.macAddress}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button
              disabled={updateDevice.isPending}
              onClick={handleSave}
              size="sm"
            >
              {updateDevice.isPending ? (
                <Spinner className="size-4" />
              ) : (
                t('common.save')
              )}
            </Button>
            <Button
              disabled={updateDevice.isPending}
              onClick={() => {
                setNickname(device.nickname);
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
              <Badge variant={device.banned ? 'destructive' : 'outline'}>
                {device.banned ? t('wifi.blocked') : t('wifi.active')}
              </Badge>
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

function PasswordChangeForm() {
  const { t } = useTranslation();
  const updatePassword = useUpdateWifiPassword();
  const [showForm, setShowForm] = useState(false);

  const form = useForm({
    defaultValues: { confirmPassword: '', newPassword: '' },
    onSubmit: async ({ value }) => {
      await updatePassword.mutateAsync({ newPassword: value.newPassword });
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
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
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
                  if (value.length < PASSWORD_MIN_LENGTH) {
                    return t('wifi.passwordTooShort');
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor={field.name}>
                    {t('wifi.newPassword')}
                  </label>
                  <PasswordInput
                    hidePasswordLabel={t('common.hidePassword')}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={t('wifi.newPasswordPlaceholder')}
                    showPasswordLabel={t('common.showPassword')}
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
                onChange: ({ value, fieldApi }) => {
                  if (!value) {
                    return t('wifi.passwordRequired');
                  }
                  if (value !== fieldApi.form.getFieldValue('newPassword')) {
                    return t('wifi.passwordMismatch');
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor={field.name}>
                    {t('wifi.confirmPassword')}
                  </label>
                  <PasswordInput
                    hidePasswordLabel={t('common.hidePassword')}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={t('wifi.confirmPasswordPlaceholder')}
                    showPasswordLabel={t('common.showPassword')}
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
                disabled={updatePassword.isPending}
                type="submit"
              >
                {updatePassword.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  t('common.save')
                )}
              </Button>
              <Button
                disabled={updatePassword.isPending}
                onClick={() => {
                  setShowForm(false);
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

function CertificateDownload() {
  const { t } = useTranslation();
  const downloadCertificate = useDownloadWifiCertificate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('wifi.certificate')}</CardTitle>
          <Button
            disabled={downloadCertificate.isPending}
            onClick={() => downloadCertificate.mutate({})}
            size="sm"
            variant="outline"
          >
            <Download className="mr-2 size-4" />
            {downloadCertificate.isPending
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
