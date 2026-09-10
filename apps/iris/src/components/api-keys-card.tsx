import { KeyRound, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ApiKeyDialog,
  type CreateApiKeyValues,
} from '@/components/api-key-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type ApiKeyItem,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from '@/hooks/api-keys';

function formatDate(
  value: string | Date | null | undefined,
  locale: string
): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(locale);
}

function isExpired(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= Date.now();
}

/** API key management, rendered as a card inside the Preferences dialog. */
export function ApiKeysCard() {
  const { t, i18n } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);

  const { data: keysData, isLoading, isError } = useApiKeys();

  const keys = keysData?.apiKeys ?? [];

  const createMutation = useCreateApiKey({
    onSuccess: (data) => {
      setCreateOpen(false);
      if (data.rawKey) {
        setRawKey(data.rawKey);
      }
    },
  });

  const revokeMutation = useRevokeApiKey();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('apiKeys.title')}</CardTitle>
        <CardDescription>{t('apiKeys.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <KeyRound className="h-4 w-4" />
            {t('apiKeys.create')}
          </Button>
        </div>

        {isLoading && <Skeleton className="h-64 w-full" />}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Shield className="size-10" />
            <p>{t('apiKeys.loadError')}</p>
          </div>
        )}

        {!(isLoading || isError) && keys.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <KeyRound className="size-10" />
            <p>{t('apiKeys.empty')}</p>
          </div>
        )}

        {!(isLoading || isError) && keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
                key={key.id}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-sm">
                      {key.name}
                    </span>
                    {isExpired(key.expiresAt) ? (
                      <Badge className="shrink-0" variant="destructive">
                        {t('apiKeys.statusExpired')}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0" variant="outline">
                        {t('apiKeys.statusActive')}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate font-mono text-muted-foreground text-xs">
                    {key.prefix}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                    <dt>{t('apiKeys.columnCreated')}</dt>
                    <dd className="truncate">
                      {formatDate(key.createdAt, i18n.language)}
                    </dd>
                    <dt>{t('apiKeys.columnLastUsed')}</dt>
                    <dd className="truncate">
                      {formatDate(key.lastUsedAt, i18n.language)}
                    </dd>
                    <dt>{t('apiKeys.columnExpires')}</dt>
                    <dd className="truncate">
                      {formatDate(key.expiresAt, i18n.language)}
                    </dd>
                  </dl>
                </div>
                <Button
                  aria-label={t('apiKeys.revoke')}
                  onClick={() => setRevokeTarget(key)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <ApiKeyDialog
          onOpenChange={setCreateOpen}
          onSubmit={(values: CreateApiKeyValues) =>
            createMutation.mutate(values)
          }
          open={createOpen}
        />

        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setRawKey(null);
            }
          }}
          open={!!rawKey}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('apiKeys.rawKeyTitle')}</DialogTitle>
              <DialogDescription>
                {t('apiKeys.rawKeyWarning')}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted p-3">
              <code className="break-all font-mono text-sm">{rawKey}</code>
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  if (rawKey) {
                    await navigator.clipboard.writeText(rawKey);
                    toast.success(t('apiKeys.copied'));
                  }
                }}
              >
                {t('apiKeys.copy')}
              </Button>
              <Button onClick={() => setRawKey(null)} variant="outline">
                {t('apiKeys.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setRevokeTarget(null);
            }
          }}
          open={!!revokeTarget}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('apiKeys.revokeConfirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('apiKeys.revokeConfirm')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setRevokeTarget(null)} variant="outline">
                {t('common.cancel')}
              </Button>
              <Button
                disabled={revokeMutation.isPending}
                onClick={() => {
                  if (revokeTarget) {
                    revokeMutation.mutate(revokeTarget.id);
                  }
                  setRevokeTarget(null);
                }}
                variant="destructive"
              >
                {t('apiKeys.revoke')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
