import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TranslationDialog } from '@/components/admin/navigator/translation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConfirmDialog } from '@/components/util/confirm-dialog';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type NavigatorTranslation,
  useDeleteTranslation,
  useTranslations,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/translations')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <TranslationsPage />
    </PermissionGuard>
  ),
});

type TranslationSortColumn = 'langKey' | 'textKey' | 'updated';

function getAriaSortState(
  column: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc' | null
): 'ascending' | 'descending' | 'none' {
  if (sortColumn !== column) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

function TranslationsPage() {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<TranslationSortColumn | null>(
    null
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTranslation, setSelectedTranslation] =
    useState<NavigatorTranslation | null>(null);

  const translationsQuery = useTranslations();
  const deleteMutation = useDeleteTranslation();

  const translations: NavigatorTranslation[] | undefined =
    translationsQuery.data?.translations;

  const filteredTranslations = useMemo(() => {
    const items = translations ?? [];
    const term = search.trim().toLowerCase();
    let filtered = items;

    if (term) {
      filtered = filtered.filter(
        (translation) =>
          translation.langKey.toLowerCase().includes(term) ||
          translation.textKey.toLowerCase().includes(term) ||
          translation.text.toLowerCase().includes(term)
      );
    }

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getTranslationSortValue(a, sortColumn);
        const bValue = getTranslationSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [translations, search, sortColumn, sortDirection]);

  const handleDelete = async (translation: NavigatorTranslation) => {
    const confirmed = await confirm({
      destructive: true,
      title: t('navigator.translations.deleteConfirm', {
        key: `${translation.langKey}:${translation.textKey}`,
      }),
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync({
      key: translation.textKey,
      lang: translation.langKey,
    });
  };

  const handleSort = (column: TranslationSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.translations.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.translations.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.translations.searchPlaceholder')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => translationsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.translations.refresh')}
          </Button>
          <Button
            onClick={() => {
              setSelectedTranslation(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('navigator.translations.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={translationsQuery.data} query={translationsQuery}>
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-2xl">
              <TableHeader>
                <TableRow>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'langKey',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('langKey')}
                      type="button"
                    >
                      {t('navigator.translations.langKey')}
                      <SortIcon
                        column="langKey"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'textKey',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('textKey')}
                      type="button"
                    >
                      {t('navigator.translations.textKey')}
                      <SortIcon
                        column="textKey"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.translations.text')}</TableHead>
                  <TableHead
                    aria-sort={getAriaSortState(
                      'updated',
                      sortColumn,
                      sortDirection
                    )}
                    className="select-none"
                  >
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
                      onClick={() => handleSort('updated')}
                      type="button"
                    >
                      {t('navigator.translations.updatedAt')}
                      <SortIcon
                        column="updated"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>{t('navigator.translations.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTranslations.map((translation) => (
                  <TableRow
                    key={`${translation.langKey}:${translation.textKey}`}
                  >
                    <TableCell className="font-mono text-xs">
                      {translation.langKey}
                    </TableCell>
                    <TableCell className="font-medium">
                      {translation.textKey}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {translation.text}
                    </TableCell>
                    <TableCell>
                      {dayjs(translation.updatedAt).format(
                        'YYYY/MM/DD HH:mm:ss'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={t('navigator.common.edit', {
                            name: `${translation.langKey}:${translation.textKey}`,
                          })}
                          onClick={() => {
                            setSelectedTranslation(translation);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={t('navigator.common.delete', {
                            name: `${translation.langKey}:${translation.textKey}`,
                          })}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(translation)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredTranslations.length && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      {t('navigator.translations.noTranslationsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <TranslationDialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedTranslation(null);
          }
        }}
        open={dialogOpen}
        record={selectedTranslation}
      />
      {dialog}
    </div>
  );
}

function getTranslationSortValue(
  translation: NavigatorTranslation,
  column: TranslationSortColumn
): string | number {
  switch (column) {
    case 'langKey':
      return translation.langKey;
    case 'textKey':
      return translation.textKey;
    case 'updated':
      return new Date(translation.updatedAt).getTime();
    default:
      return '';
  }
}
