import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EntityDef, FieldDef } from './config';

const PAGE_SIZE = 50;

export function EntityManager<TRow extends { id: string }, TInput>({
  entity,
  queryKey,
}: {
  entity: EntityDef<TRow, TInput>;
  queryKey: string[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TRow | null>(null);

  const listQuery = useQuery({
    queryFn: () =>
      entity.api.list({ limit: PAGE_SIZE, offset: 0, search: query }),
    queryKey: [...queryKey, 'list', query],
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...queryKey] });

  const createMutation = useMutation({
    mutationFn: entity.api.create,
    onError: () => toast.error(t('entity.createError')),
    onSuccess: () => {
      toast.success(t('entity.createSuccess'));
      invalidate();
      setOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { body: Partial<TInput>; id: string }) =>
      entity.api.update(id, body),
    onError: () => toast.error(t('entity.updateError')),
    onSuccess: () => {
      toast.success(t('entity.updateSuccess'));
      invalidate();
      setOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: entity.api.remove,
    onError: () => toast.error(t('entity.deleteError')),
    onSuccess: () => {
      toast.success(t('entity.deleteSuccess'));
      invalidate();
    },
  });

  const rows: TRow[] = listQuery.data?.rows ?? [];
  const isPending =
    listQuery.isPending || createMutation.isPending || updateMutation.isPending;

  const form = useForm({
    defaultValues: rowToForm(editing, entity),
    onSubmit: ({ value }) => {
      if (editing) {
        updateMutation.mutate({
          body: value as Partial<TInput>,
          id: editing.id,
        });
      } else {
        createMutation.mutate(value as TInput);
      }
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: form.reset is stable; only reset when the dialog opens
  useEffect(() => {
    if (open) {
      form.reset(rowToForm(editing, entity));
    }
  }, [open, editing, entity]);

  const filteredRows = useMemo(() => rows, [rows]);
  const fields = entity.fields;

  const handleSearchSubmit = () => {
    setQuery(search.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-64"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearchSubmit();
            }
          }}
          placeholder={t('entity.searchPlaceholder')}
          value={search}
        />
        <Button onClick={handleSearchSubmit} variant="outline">
          {t('entity.search')}
        </Button>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('entity.create')}
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full min-w-3xl">
          <TableHeader>
            <TableRow>
              {fields.map((field) => (
                <TableHead key={field.key}>{t(field.labelKey)}</TableHead>
              ))}
              <TableHead>{t('entity.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-muted-foreground"
                  colSpan={fields.length + 1}
                >
                  {t('entity.noRecords')}
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                {fields.map((field) => (
                  <TableCell key={field.key}>
                    {formatCell((row as Record<string, unknown>)[field.key])}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditing(row);
                        setOpen(true);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate(row.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('entity.editTitle', { name: t(entity.titleKey) })
                : t('entity.createTitle', { name: t(entity.titleKey) })}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            {fields.map((field) => (
              <form.Field key={field.key} name={field.key}>
                {(f) => (
                  <Field>
                    <FieldLabel htmlFor={field.key}>
                      {t(field.labelKey)}
                    </FieldLabel>
                    <FieldInput
                      field={field}
                      onChange={f.handleChange}
                      value={f.state.value}
                    />
                    <FieldError errors={f.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            ))}
            <DialogFooter>
              <Button disabled={isPending} type="submit">
                {t('entity.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function rowToForm(
  row: { id: string } | null,
  entity: { fields: FieldDef[] }
): Record<string, unknown> {
  const source = (row ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    entity.fields.map((field) => [
      field.key,
      source[field.key] ?? (field.type === 'checkbox' ? false : ''),
    ])
  );
}

function formatCell(value: unknown): string {
  if (value == null || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '—';
  }
  return String(value);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  if (field.type === 'number') {
    return (
      <Input
        id={field.key}
        inputMode="numeric"
        onChange={(e) => onChange(Number(e.target.value))}
        type="number"
        value={String(value ?? '')}
      />
    );
  }
  if (field.type === 'checkbox') {
    return (
      <Checkbox
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }
  return (
    <Input
      id={field.key}
      onChange={(e) => onChange(e.target.value)}
      value={String(value ?? '')}
    />
  );
}
