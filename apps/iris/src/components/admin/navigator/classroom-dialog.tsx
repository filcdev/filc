import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type NavigatorClassroom,
  useBuildings,
  useClassroomTypes,
  useUpsertClassroom,
} from '@/hooks/navigator';
import { navigatorClassroomSchema } from '@/utils/form-schemas';
import {
  asNavigatorFormValidator,
  type ClassroomDialogProps,
  selectPlaceholder,
} from './types';

const initialState = (record: NavigatorClassroom | null) => ({
  buildingId: record?.buildingId ?? '',
  capacity: record ? String(record.capacity) : '',
  description: record?.description ?? '',
  name: record?.name ?? '',
  rotation: record ? String(record.rotation) : '',
  sizeX: record ? String(record.sizeX) : '',
  sizeY: record ? String(record.sizeY) : '',
  sizeZ: record ? String(record.sizeZ) : '',
  storey: record ? String(record.storey) : '',
  typeId: record?.typeId ?? '',
  x: record ? String(record.x) : '',
  y: record ? String(record.y) : '',
});

type ClassroomFormValues = ReturnType<typeof initialState>;

export function ClassroomDialog({
  record,
  open,
  onOpenChange,
}: ClassroomDialogProps) {
  const { t } = useTranslation();
  const buildingsQuery = useBuildings();
  const classroomTypesQuery = useClassroomTypes();
  const upsert = useUpsertClassroom({ onSaved: () => onOpenChange(false) });

  const buildingItems = (buildingsQuery.data?.buildings ?? []).map((b) => ({
    label: b.name,
    value: b.id,
  }));

  const typeItems = (classroomTypesQuery.data?.classroomTypes ?? []).map(
    (ct) => ({ label: ct.name, value: ct.id })
  );

  const buildingPlaceholder = selectPlaceholder(
    buildingsQuery.isLoading,
    buildingItems.length === 0,
    t('common.loading'),
    t('navigator.common.noBuildings'),
    t('navigator.common.selectBuilding')
  );

  const typePlaceholder = selectPlaceholder(
    classroomTypesQuery.isLoading,
    typeItems.length === 0,
    t('common.loading'),
    t('navigator.common.noClassroomTypes'),
    t('navigator.common.selectType')
  );

  const form = useForm({
    defaultValues: initialState(record),
    onSubmit: ({ value }) => {
      const payload = {
        buildingId: value.buildingId,
        capacity: Number(value.capacity),
        description: value.description,
        name: value.name.trim(),
        rotation: Number(value.rotation),
        sizeX: Number(value.sizeX),
        sizeY: Number(value.sizeY),
        sizeZ: Number(value.sizeZ),
        storey: Number(value.storey),
        typeId: value.typeId,
        x: Number(value.x),
        y: Number(value.y),
      };
      upsert.mutate(record ? { id: record.id, payload } : { payload });
    },
    validators: {
      onSubmit: asNavigatorFormValidator<ClassroomFormValues>(
        navigatorClassroomSchema
      ),
    },
  });

  useEffect(() => {
    form.reset(initialState(record));
  }, [record, form.reset]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {record
              ? t('navigator.classrooms.editTitle')
              : t('navigator.classrooms.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.common.name')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('navigator.common.description')}
                </FieldLabel>
                <Textarea
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="buildingId">
              {(field) => (
                <Field>
                  <FieldLabel>{t('navigator.common.building')}</FieldLabel>
                  <Select
                    items={buildingItems}
                    onValueChange={(value) => field.handleChange(value ?? '')}
                    value={field.state.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={buildingPlaceholder} />
                    </SelectTrigger>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="typeId">
              {(field) => (
                <Field>
                  <FieldLabel>{t('navigator.classrooms.type')}</FieldLabel>
                  <Select
                    items={typeItems}
                    onValueChange={(value) => field.handleChange(value ?? '')}
                    value={field.state.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={typePlaceholder} />
                    </SelectTrigger>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="capacity">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.classrooms.capacity')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="storey">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.common.storey')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="x">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.common.x')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="y">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.common.y')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="rotation">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.common.rotation')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="sizeX">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.classrooms.sizeX')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="sizeY">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.classrooms.sizeY')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="sizeZ">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('navigator.classrooms.sizeZ')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="number"
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!form.state.canSubmit || upsert.isPending}
              type="submit"
            >
              {record
                ? t('navigator.common.save')
                : t('navigator.common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
