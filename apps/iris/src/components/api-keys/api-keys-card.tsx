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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import { Empty } from '@filcdev/ui/components/empty';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { KeyRound, MoreHorizontal, Plus } from 'lucide-react';
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
 * One key as a list row.
 *
 * A table cannot work here: seven columns need ~900px and the settings dialog
 * gives the pane about half of that, so every row would scroll sideways. The
 * timestamps that matter are the two an operator reads — created and last used
 * — and the rest sit in the actions menu.
 */
function ApiKeyRow({
  apiKey,
  onRename,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  apiKey: UserApiKey;
  onRename: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const { t, i18n } = useTranslation();

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">
            {apiKey.name ?? t('apiKeys.unnamed')}
          </span>
          <Badge variant={apiKey.enabled ? 'default' : 'secondary'}>
            {t(apiKey.enabled ? 'apiKeys.enabled' : 'apiKeys.disabled')}
          </Badge>
        </div>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {apiKey.start ?? apiKey.prefix ?? t('apiKeys.unknownKey')}
        </span>
        <span className="text-muted-foreground text-xs">
          {t('apiKeys.created')}:{' '}
          {formatTimestamp(
            apiKey.createdAt,
            i18n.language,
            t('apiKeys.unknownDate')
          )}
          {' · '}
          {t('apiKeys.lastUsed')}:{' '}
          {formatTimestamp(
            apiKey.lastRequest,
            i18n.language,
            t('apiKeys.neverUsed')
          )}
          {' · '}
          {t('apiKeys.expires')}:{' '}
          {formatTimestamp(apiKey.expiresAt, i18n.language, t('apiKeys.never'))}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('apiKeys.actions')}
              className="shrink-0"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            {t('apiKeys.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isToggling} onClick={onToggle}>
            {t(apiKey.enabled ? 'apiKeys.disable' : 'apiKeys.enable')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isDeleting}
            onClick={onDelete}
            variant="destructive"
          >
            {t('apiKeys.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * The signed-in user's own API keys: list, create, rename, toggle and revoke.
 *
 * better-auth scopes these endpoints to the session, so the card lists exactly
 * the caller's keys — there is no owner column and no permission to gate on
 * beyond being signed in, which the `_private` tree already guarantees.
 */
export function ApiKeysCard() {
  const { t } = useTranslation();
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
        {!(apiKeysQuery.isLoading || apiKeysQuery.isError) &&
          (apiKeys.length === 0 ? (
            <Empty
              description={t('apiKeys.noKeys')}
              icon={<KeyRound />}
              title={t('apiKeys.title')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {apiKeys.map((apiKey) => (
                <ApiKeyRow
                  apiKey={apiKey}
                  isDeleting={deleteApiKey.isPending}
                  isToggling={updateApiKey.isPending}
                  key={apiKey.id}
                  onDelete={() => handleDelete(apiKey)}
                  onRename={() => setRenaming(apiKey)}
                  onToggle={() =>
                    updateApiKey.mutate({
                      enabled: !apiKey.enabled,
                      keyId: apiKey.id,
                    })
                  }
                />
              ))}
            </ul>
          ))}
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
