import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { THEME_COPY, windowText } from '@/components/admin/theme-catalog';
import { ThemeScheduleDialog } from '@/components/admin/theme-schedule-dialog';
import {
  type ThemeScheduleItem,
  useDeleteThemeSchedule,
  useThemeSchedule,
} from '@/hooks/site-theme';

/**
 * The admin-editable annual schedule: the rows that override the manual skin
 * while they are in season, plus their create/edit/delete flows.
 *
 * Owns its own query so the picker above does not have to thread the list
 * down; React Query dedupes it against any other `theme.schedule.list` reader.
 */
export function ThemeSchedulePanel() {
  const { i18n, t } = useTranslation();
  const scheduleQuery = useThemeSchedule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<ThemeScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThemeScheduleItem | null>(
    null
  );
  const deleteMutation = useDeleteThemeSchedule({
    onSaved: () => setDeleteTarget(null),
  });

  const items = scheduleQuery.data ?? [];

  const openCreate = () => {
    setDialogItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item: ThemeScheduleItem) => {
    setDialogItem(item);
    setDialogOpen(true);
  };

  const renderRows = () => {
    if (scheduleQuery.isLoading) {
      return <Skeleton className="h-24 w-full rounded-2xl" />;
    }

    if (items.length === 0) {
      return (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          {t('siteTheme.schedule.empty')}
        </p>
      );
    }

    return (
      <ul className="divide-y overflow-hidden rounded-2xl border">
        {items.map((item) => (
          <li className="flex flex-wrap items-center gap-3 p-4" key={item.id}>
            <span className="font-medium">
              {t(THEME_COPY[item.theme].nameKey)}
            </span>
            <span className="text-muted-foreground text-sm">
              {windowText(item, i18n.language)}
            </span>
            {item.active && <Badge>{t('siteTheme.schedule.active')}</Badge>}
            <div className="ml-auto flex items-center gap-1">
              <Button
                aria-label={`${t('siteTheme.schedule.edit')}: ${t(THEME_COPY[item.theme].nameKey)}`}
                onClick={() => openEdit(item)}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                aria-label={`${t('siteTheme.schedule.delete')}: ${t(THEME_COPY[item.theme].nameKey)}`}
                onClick={() => setDeleteTarget(item)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-xl">
            {t('siteTheme.schedule.title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground text-sm">
            {t('siteTheme.schedule.description')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('siteTheme.schedule.add')}
        </Button>
      </div>

      {renderRows()}

      <ThemeScheduleDialog
        item={dialogItem}
        key={`${dialogOpen ? 'open' : 'closed'}:${dialogItem?.id ?? 'new'}`}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />

      <DeleteConfirmDialog
        description={t('siteTheme.schedule.deleteConfirmDescription', {
          theme: deleteTarget ? t(THEME_COPY[deleteTarget.theme].nameKey) : '',
          window: deleteTarget ? windowText(deleteTarget, i18n.language) : '',
        })}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
        pending={deleteMutation.isPending}
        title={t('siteTheme.schedule.deleteConfirmTitle')}
      />
    </section>
  );
}
