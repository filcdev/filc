import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  useAvailableLanguages,
  useDeleteNavigatorTranslation,
  useNavigatorTranslations,
  useSaveNavigatorTranslation,
  useUpdateNavigatorTranslation,
} from '@/hooks/navigator';

export const Route = createFileRoute('/_private/admin/navigator/translations')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <TranslationsPage />
    </PermissionGuard>
  ),
});

type TranslationGroup = {
  key: string;
  values: Record<string, string>;
};

type TranslationDialogProps = BaseDialogProps & {
  group: TranslationGroup | null;
  languages: string[];
};

function TranslationDialog({
  group,
  languages,
  onOpenChange,
  open,
}: TranslationDialogProps) {
  const { t } = useTranslation();
  const saveTranslation = useSaveNavigatorTranslation({
    onSaved: () => onOpenChange(false),
  });
  const updateTranslation = useUpdateNavigatorTranslation();

  const form = useForm({
    defaultValues: {
      key: group?.key ?? '',
      translations: Object.fromEntries(
        languages.map((lang) => [lang, group?.values[lang] ?? ''])
      ) as Record<string, string>,
    },
    onSubmit: ({ value }) => {
      if (!group) {
        saveTranslation.mutate({
          text_key: value.key,
          translations: value.translations,
        });
        return;
      }

      const changed = languages.filter(
        (lang) =>
          (value.translations[lang] ?? '') !== (group.values[lang] ?? '')
      );
      Promise.all(
        changed.map((lang) =>
          updateTranslation.mutateAsync({
            key: group.key,
            lang,
            payload: { text: value.translations[lang] ?? '' },
          })
        )
      ).then(() => onOpenChange(false));
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        key: group?.key ?? '',
        translations: Object.fromEntries(
          languages.map((lang) => [lang, group?.values[lang] ?? ''])
        ) as Record<string, string>,
      });
    }
  }, [open, group, languages, form.reset]);

  const isPending = saveTranslation.isPending || updateTranslation.isPending;
  // Subscribed, not read off `form.state` in render: the codename arrives with
  // the dialog's reset, which does not re-render the footer on its own.
  const key = useStore(form.store, (state) => state.values.key);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group
              ? t('navigator.translations.editTitle')
              : t('navigator.translations.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="key">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.translations.key')}
                </FieldLabel>
                <Input
                  disabled={group !== null}
                  id={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="translations">
            {(field) => (
              <div className="space-y-4">
                {languages.map((lang) => (
                  <Field key={lang}>
                    <FieldLabel htmlFor={`translation-${lang}`}>
                      {lang}
                    </FieldLabel>
                    <Input
                      id={`translation-${lang}`}
                      onChange={(event) =>
                        field.handleChange({
                          ...field.state.value,
                          [lang]: event.target.value,
                        })
                      }
                      value={field.state.value[lang] ?? ''}
                    />
                  </Field>
                ))}
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={isPending || key.length === 0} type="submit">
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TranslationsPage() {
  const { t } = useTranslation();
  const translations = useNavigatorTranslations();
  const languagesQuery = useAvailableLanguages();
  const deleteTranslation = useDeleteNavigatorTranslation();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TranslationGroup | null>(
    null
  );

  const languages = languagesQuery.data ?? [];

  const groups = useMemo(() => {
    const byKey: Record<string, Record<string, string>> = {};
    for (const row of translations.data ?? []) {
      let entry = byKey[row.text_key];
      if (!entry) {
        entry = {};
        byKey[row.text_key] = entry;
      }
      entry[row.lang_key] = row.text;
    }
    return Object.entries(byKey).map(([key, values]) => ({ key, values }));
  }, [translations.data]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return groups;
    }
    return groups.filter((group) => group.key.toLowerCase().includes(term));
  }, [groups, search]);

  const columns: EntityTableColumn<TranslationGroup>[] = [
    {
      className: 'font-mono',
      header: t('navigator.translations.key'),
      key: 'key',
      render: (group) => group.key,
    },
    ...languages.map((lang) => ({
      header: lang,
      key: lang,
      render: (group: TranslationGroup) => group.values[lang] ?? '',
    })),
  ];

  const startCreate = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const startEdit = (group: TranslationGroup) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const removeGroup = (group: TranslationGroup) => {
    for (const lang of Object.keys(group.values)) {
      deleteTranslation.mutate({ key: group.key, lang });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.translations.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.translations.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => translations.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            {t('navigator.translations.add')}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('navigator.translations.searchPlaceholder')}
          value={search}
        />
      </div>

      <QueryBoundary data={translations.data} query={translations}>
        {() => (
          <EntityTable
            columns={columns}
            getRowId={(group) => group.key}
            getRowLabel={(group) => group.key}
            onDelete={removeGroup}
            onEdit={startEdit}
            rows={visibleGroups}
          />
        )}
      </QueryBoundary>

      <TranslationDialog
        group={editingGroup}
        languages={languages}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}
