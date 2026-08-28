import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApiMutation, useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type ApiKeysResponse = InferResponseType<
  (typeof api.users.me)['api-keys']['$get']
>;
type ApiKeysData = NonNullable<ApiKeysResponse['data']>;
type ApiKeyItem = ApiKeysData['apiKeys'][number];

type CreateApiKeyData = NonNullable<
  InferResponseType<(typeof api.users.me)['api-keys']['$post']>['data']
>;

export const Route = createFileRoute('/_private/api-keys/')({
  component: ApiKeysPage,
});

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

function ApiKeysPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);

  const {
    data: keysData,
    isLoading,
    isError,
  } = useApiQuery<ApiKeysData>(() => api.users.me['api-keys'].$get(), {
    queryKey: queryKeys.apiKeys.list(),
  });

  const keys = keysData?.apiKeys ?? [];

  const createMutation = useApiMutation<CreateApiKeyData, CreateApiKeyValues>({
    mutationFn: ({ name, expiresAt }) =>
      api.users.me['api-keys'].$post({ json: { expiresAt, name } }),
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.createError'));
    },
    onSuccess: (data) => {
      toast.success(t('apiKeys.createSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
      setCreateOpen(false);
      if (data.rawKey) {
        setRawKey(data.rawKey);
      }
    },
  });

  const revokeMutation = useApiMutation<void, string>({
    mutationFn: (id) =>
      api.users.me['api-keys'][':id'].$delete({ param: { id } }),
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.revokeError'));
    },
    onSuccess: () => {
      toast.success(t('apiKeys.revokeSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <KeyRound className="size-6 text-primary" />
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {t('apiKeys.title')}
            </h1>
            <p className="text-muted-foreground">{t('apiKeys.description')}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <KeyRound className="h-4 w-4" />
          {t('apiKeys.create')}
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <Shield className="size-10" />
          <p>{t('apiKeys.loadError')}</p>
        </div>
      )}

      {!(isLoading || isError) && keys.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <KeyRound className="size-10" />
          <p>{t('apiKeys.empty')}</p>
        </div>
      )}

      {!(isLoading || isError) && keys.length > 0 && (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="w-full min-w-3xl">
            <TableHeader>
              <TableRow>
                <TableHead>{t('apiKeys.columnName')}</TableHead>
                <TableHead>{t('apiKeys.columnPrefix')}</TableHead>
                <TableHead>{t('apiKeys.columnCreated')}</TableHead>
                <TableHead>{t('apiKeys.columnLastUsed')}</TableHead>
                <TableHead>{t('apiKeys.columnExpires')}</TableHead>
                <TableHead>{t('apiKeys.columnStatus')}</TableHead>
                <TableHead>{t('apiKeys.columnActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {key.prefix}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.createdAt, i18n.language)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.lastUsedAt, i18n.language)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.expiresAt, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {isExpired(key.expiresAt) ? (
                      <Badge variant="destructive">
                        {t('apiKeys.statusExpired')}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t('apiKeys.statusActive')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => setRevokeTarget(key)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      {t('apiKeys.revoke')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ApiKeyDialog
        isPending={createMutation.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={(values) => createMutation.mutate(values)}
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
            <DialogDescription>{t('apiKeys.rawKeyWarning')}</DialogDescription>
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
            <DialogDescription>{t('apiKeys.revokeConfirm')}</DialogDescription>
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
    </div>
  );
}
