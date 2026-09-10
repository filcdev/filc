import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
            <FieldLabel htmlFor="teacher-name">{t('teachers.name')}</FieldLabel>
            <Input
              disabled
              id="teacher-name"
              value={`${teacher.firstName} ${teacher.lastName}`.trim()}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="teacher-short">
              {t('teachers.short')}
            </FieldLabel>
            <Input disabled id="teacher-short" value={teacher.short} />
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
