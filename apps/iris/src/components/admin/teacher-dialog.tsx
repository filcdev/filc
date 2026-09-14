import { Button } from '@filcdev/ui/components/button';
import { Combobox } from '@filcdev/ui/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  type AdminTeacher,
  useTeacherUserOptions,
  useUpdateTeacher,
} from '@/hooks/timetable-teachers';
import type { BaseDialogProps } from './admin.types';

const teacherFormSchema = z.object({
  email: z.union([z.email(), z.literal('')]),
  userId: z.string(),
});

type TeacherDialogProps = BaseDialogProps & {
  teacher: AdminTeacher;
};

export function TeacherDialog({
  onOpenChange,
  open,
  teacher,
}: TeacherDialogProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const shortId = useId();
  const usersQuery = useTeacherUserOptions();
  const updateTeacher = useUpdateTeacher({
    onSaved: () => onOpenChange(false),
  });

  const userOptions = (usersQuery.data ?? []).map((u) => ({
    label: `${u.name} (${u.email})`,
    value: u.id,
  }));

  const form = useForm({
    defaultValues: {
      email: teacher.email ?? '',
      userId: teacher.userId ?? '',
    },
    onSubmit: ({ value }) => {
      updateTeacher.mutate({
        email: value.email === '' ? null : value.email,
        id: teacher.id,
        userId: value.userId === '' ? null : value.userId,
      });
    },
    validators: { onSubmit: teacherFormSchema },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('teachers.editTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <Field>
            <FieldLabel htmlFor={nameId}>{t('teachers.name')}</FieldLabel>
            <Input
              disabled
              id={nameId}
              value={`${teacher.firstName} ${teacher.lastName}`.trim()}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={shortId}>{t('teachers.short')}</FieldLabel>
            <Input disabled id={shortId} value={teacher.short} />
          </Field>
          <form.Field name="email">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('teachers.email')}
                </FieldLabel>
                <Input
                  autoComplete="email"
                  id={field.name}
                  inputMode="email"
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('teachers.emailPlaceholder')}
                  type="email"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="userId">
            {(field) => (
              <Field>
                <FieldLabel>{t('teachers.assignedUser')}</FieldLabel>
                <Combobox
                  emptyMessage={t('teachers.noUsersFound')}
                  onValueChange={(value) => field.handleChange(value)}
                  options={userOptions}
                  placeholder={t('teachers.assignedUserPlaceholder')}
                  searchPlaceholder={t('search')}
                  value={field.state.value}
                />
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
            <Button disabled={!form.state.canSubmit} type="submit">
              {t('teachers.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
