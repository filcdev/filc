import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import {
  type AdminApiKey,
  useAdminDeleteApiKey,
  useAdminUpdateApiKey,
} from '@/hooks/admin-api-keys';
import { confirmDestructiveAction } from '@/utils/confirm';
import { formatLocalizedDate } from '@/utils/date-locale';

dayjs.extend(relativeTime);

type AdminApiKeysTableProps = {
  apiKeys: AdminApiKey[];
  /**
   * When the list is already scoped to one owner, the Owner column is redundant
   * and is dropped.
   */
  ownerId?: string;
};

/** `null`/`undefined` and unparsable values render as `nullLabel`. */
function renderTimestamp(
  value: string | number | Date | null | undefined,
  language: string,
  nullLabel: string
): string {
  if (value === null || value === undefined) {
    return nullLabel;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return nullLabel;
  }
  return formatLocalizedDate(date, language);
}

/** When the key was last used, or "never" — the `lastRequest` column is nullable. */
function renderLastUsed(
  value: AdminApiKey['lastRequest'],
  language: string,
  neverLabel: string
): string {
  if (value === null || value === undefined) {
    return neverLabel;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return neverLabel;
  }
  const relative = dayjs(date).locale(language).fromNow();
  return `${formatLocalizedDate(date, language)} (${relative})`;
}

export function AdminApiKeysTable({
  apiKeys,
  ownerId,
}: AdminApiKeysTableProps) {
  const { i18n, t } = useTranslation();
  const updateApiKey = useAdminUpdateApiKey();
  const deleteApiKey = useAdminDeleteApiKey();

  const neverLabel = t('adminApiKeys.never');
  const language = i18n.language;
  const showOwner = !ownerId;

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-5xl">
        <TableHeader>
          <TableRow>
            {showOwner && <TableHead>{t('adminApiKeys.owner')}</TableHead>}
            <TableHead>{t('adminApiKeys.keyName')}</TableHead>
            <TableHead>{t('adminApiKeys.prefix')}</TableHead>
            <TableHead>{t('adminApiKeys.created')}</TableHead>
            <TableHead>{t('adminApiKeys.expires')}</TableHead>
            <TableHead>{t('adminApiKeys.lastUsed')}</TableHead>
            <TableHead>{t('adminApiKeys.status')}</TableHead>
            <TableHead>{t('adminApiKeys.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.length === 0 && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={showOwner ? 8 : 7}
              >
                {t('adminApiKeys.noKeys')}
              </TableCell>
            </TableRow>
          )}
          {apiKeys.map((apiKey) => {
            const ownerLabel = apiKey.ownerName ?? apiKey.ownerEmail;
            const ownerDetail =
              apiKey.ownerName && apiKey.ownerEmail
                ? apiKey.ownerEmail
                : (apiKey.referenceId ?? '—');
            const prefix = apiKey.prefix ?? apiKey.start ?? '—';

            return (
              <TableRow key={apiKey.id}>
                {showOwner && (
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{ownerLabel ?? '—'}</span>
                      <span className="text-muted-foreground text-xs">
                        {ownerDetail}
                      </span>
                    </div>
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {apiKey.name ?? '—'}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {prefix}
                  </code>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {renderTimestamp(apiKey.createdAt, language, '—')}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {renderTimestamp(apiKey.expiresAt, language, neverLabel)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {renderLastUsed(apiKey.lastRequest, language, neverLabel)}
                </TableCell>
                <TableCell>
                  <Badge variant={apiKey.enabled ? 'secondary' : 'destructive'}>
                    {apiKey.enabled
                      ? t('adminApiKeys.enabled')
                      : t('adminApiKeys.disabled')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
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
                      {apiKey.enabled
                        ? t('adminApiKeys.disable')
                        : t('adminApiKeys.enable')}
                    </Button>
                    <Button
                      disabled={deleteApiKey.isPending}
                      onClick={() => {
                        if (
                          !confirmDestructiveAction(
                            t('adminApiKeys.deleteConfirm', {
                              name: apiKey.name ?? prefix,
                            })
                          )
                        ) {
                          return;
                        }
                        deleteApiKey.mutate({ keyId: apiKey.id });
                      }}
                      size="sm"
                      variant="destructive"
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
