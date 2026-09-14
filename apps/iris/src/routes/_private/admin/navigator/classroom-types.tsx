import type { ClassroomType } from '@filcdev/api/domains/navigator/classroom-type';
import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  useClassroomTypes,
  useCreateClassroomType,
  useDeleteClassroomType,
  useUpdateClassroomType,
} from '@/hooks/navigator';

export const Route = createFileRoute(
  '/_private/admin/navigator/classroom-types'
)({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <ClassroomTypesPage />
    </PermissionGuard>
  ),
});

const COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

type ClassroomTypeDialogProps = BaseDialogProps & {
  classroomType: ClassroomType | null;
};

function ClassroomTypeDialog({
  classroomType,
  onOpenChange,
  open,
}: ClassroomTypeDialogProps) {
  const { t } = useTranslation();
  const createType = useCreateClassroomType({
    onSaved: () => onOpenChange(false),
  });
  const updateType = useUpdateClassroomType({
    onSaved: () => onOpenChange(false),
  });

  const form = useForm({
    defaultValues: {
      colorhex: classroomType?.colorhex ?? '#1a2b3c',
      name: classroomType?.name ?? '',
    },
    onSubmit: ({ value }) => {
      if (classroomType) {
        updateType.mutate({ id: classroomType.id, payload: value });
      } else {
        createType.mutate(value);
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        colorhex: classroomType?.colorhex ?? '#1a2b3c',
        name: classroomType?.name ?? '',
      });
    }
  }, [open, classroomType, form.reset]);

  const colorhex = useStore(form.store, (state) => state.values.colorhex);
  const name = useStore(form.store, (state) => state.values.name);
  const isPending = createType.isPending || updateType.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {classroomType
              ? t('navigator.classroomTypes.editTitle')
              : t('navigator.classroomTypes.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.fields.name')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="colorhex">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.fields.colorhex')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="color"
                  value={field.state.value}
                />
                {!COLOR_HEX_REGEX.test(field.state.value) && (
                  <FieldError
                    errors={[t('navigator.classroomTypes.colorError')]}
                  />
                )}
              </Field>
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
            <Button
              disabled={
                isPending ||
                name.length === 0 ||
                !COLOR_HEX_REGEX.test(colorhex)
              }
              type="submit"
            >
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassroomTypesPage() {
  const { t } = useTranslation();
  const classroomTypes = useClassroomTypes();
  const deleteClassroomType = useDeleteClassroomType();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ClassroomType | null>(null);

  const startCreate = () => {
    setEditingType(null);
    setDialogOpen(true);
  };

  const startEdit = (classroomType: ClassroomType) => {
    setEditingType(classroomType);
    setDialogOpen(true);
  };

  const columns: EntityTableColumn<ClassroomType>[] = [
    {
      header: t('navigator.fields.name'),
      key: 'name',
      render: (classroomType) => classroomType.name,
    },
    {
      header: t('navigator.fields.colorhex'),
      key: 'colorhex',
      render: (classroomType) => (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 rounded border"
            style={{ backgroundColor: classroomType.colorhex }}
          />
          {classroomType.colorhex}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('navigator.classroomTypes.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('navigator.classroomTypes.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => classroomTypes.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('navigator.refresh')}
          </Button>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            {t('navigator.classroomTypes.add')}
          </Button>
        </div>
      </div>

      <QueryBoundary data={classroomTypes.data} query={classroomTypes}>
        {(rows) => (
          <EntityTable
            columns={columns}
            getRowId={(classroomType) => classroomType.id}
            getRowLabel={(classroomType) => classroomType.name}
            onDelete={(classroomType) =>
              deleteClassroomType.mutate(classroomType.id)
            }
            onEdit={startEdit}
            rows={rows}
          />
        )}
      </QueryBoundary>

      <ClassroomTypeDialog
        classroomType={editingType}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}
