import { useSession } from '@filcdev/auth/client';
import { Alert, AlertTitle } from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateApiKeyDialog } from '@/components/api-keys/create-api-key-dialog';
import { RenameApiKeyDialog } from '@/components/api-keys/rename-api-key-dialog';
import {
  type UserApiKey,
  useApiKeys,
  useDeleteApiKey,
  useUpdateApiKey,
} from '@/hooks/api-keys';
import { confirmDestructiveAction } from '@/utils/confirm';
import { formatLocalizedDate } from '@/utils/date-locale';

/** Nullable timestamps collapse to a translated placeholder. */
function formatTimestamp(
  value: string | number | Date | null,
  language: string,
  fallback: string
): string {
  if (value === null) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return formatLocalizedDate(date, language);
}

/**
 * The signed-in user's own API keys: list, create, rename, toggle and revoke.
 *
 * better-auth scopes these endpoints to the session, so the card lists exactly
 * the caller's keys — there is no owner column and no permission to gate on
 * beyond being signed in, which the `_private` tree already guarantees.
 */
export function ApiKeysCard() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<UserApiKey | null>(null);

  const userId = session?.user.id;
  const apiKeysQuery = useApiKeys(userId);
  const updateApiKey = useUpdateApiKey();
  const deleteApiKey = useDeleteApiKey();

  if (userId === undefined) {
    return null;
  }

  const apiKeys = apiKeysQuery.data?.apiKeys ?? [];

  const handleDelete = (apiKey: UserApiKey) => {
    const label = apiKey.name ?? t('apiKeys.unnamed');
    const confirmed = confirmDestructiveAction(
      t('apiKeys.deleteConfirm', { name: label })
    );
    if (confirmed) {
      deleteApiKey.mutate({ keyId: apiKey.id });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('apiKeys.title')}</CardTitle>
        <CardDescription>{t('apiKeys.description')}</CardDescription>
        <CardAction>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus />
            {t('apiKeys.createKey')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {apiKeysQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {apiKeysQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>{t('apiKeys.loadError')}</AlertTitle>
          </Alert>
        )}
        {!(apiKeysQuery.isLoading || apiKeysQuery.isError) && (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-4xl">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('apiKeys.name')}</TableHead>
                  <TableHead>{t('apiKeys.key')}</TableHead>
                  <TableHead>{t('apiKeys.created')}</TableHead>
                  <TableHead>{t('apiKeys.expires')}</TableHead>
                  <TableHead>{t('apiKeys.lastUsed')}</TableHead>
                  <TableHead>{t('apiKeys.status')}</TableHead>
                  <TableHead>{t('apiKeys.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={7}>
                      {t('apiKeys.noKeys')}
                    </TableCell>
                  </TableRow>
                )}
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">
                      {apiKey.name ?? t('apiKeys.unnamed')}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {apiKey.start ?? apiKey.prefix ?? t('apiKeys.unknownKey')}
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(
                        apiKey.createdAt,
                        i18n.language,
                        t('apiKeys.unknownDate')
                      )}
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(
                        apiKey.expiresAt,
                        i18n.language,
                        t('apiKeys.never')
                      )}
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(
                        apiKey.lastRequest,
                        i18n.language,
                        t('apiKeys.neverUsed')
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={apiKey.enabled ? 'default' : 'secondary'}>
                        {t(
                          apiKey.enabled
                            ? 'apiKeys.enabled'
                            : 'apiKeys.disabled'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setRenaming(apiKey)}
                          size="sm"
                          variant="outline"
                        >
                          {t('apiKeys.rename')}
                        </Button>
                        <Button
                          disabled={updateApiKey.isPending}
                          onClick={() =>
                            updateApiKey.mutate({
                              enabled: !apiKey.enabled,
                              keyId: apiKey.id,
                            })
                          }
                          size="sm"
                          variant="outline"
                        >
                          {t(
                            apiKey.enabled
                              ? 'apiKeys.disable'
                              : 'apiKeys.enable'
                          )}
                        </Button>
                        <Button
                          disabled={deleteApiKey.isPending}
                          onClick={() => handleDelete(apiKey)}
                          size="sm"
                          variant="destructive"
                        >
                          {t('apiKeys.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {isCreateOpen && (
        <CreateApiKeyDialog
          onOpenChange={setIsCreateOpen}
          open={isCreateOpen}
        />
      )}
      {renaming !== null && (
        <RenameApiKeyDialog
          apiKey={renaming}
          onOpenChange={(open) => {
            if (!open) {
              setRenaming(null);
            }
          }}
          open
        />
      )}
    </Card>
  );
}
