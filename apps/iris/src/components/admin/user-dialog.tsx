import { useForm, useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type User,
  useCohorts,
  useRoles,
  useUpdateUser,
} from '@/hooks/admin-users';
import type { BaseDialogProps } from './admin.types';

type UserDialogProps = BaseDialogProps & {
  user: User;
};

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const { t } = useTranslation();

  const rolesQuery = useRoles();
  const cohortsQuery = useCohorts();

  const cohortItems = (cohortsQuery.data ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const availableRoles = rolesQuery.data?.roles ?? [];

  const updateUser = useUpdateUser({ onSaved: () => onOpenChange(false) });

  const form = useForm({
    defaultValues: {
      cohortId: user.cohortId ?? null,
      nickname: user.nickname ?? '',
      roles: user.roles as string[],
    },
    onSubmit: ({ value }) => {
      updateUser.mutate({ id: user.id, ...value });
    },
  });

  const selectedRoles = useStore(form.store, (state) => state.values.roles);

  const toggleRole = (roleName: string, checked: boolean) => {
    const current = form.getFieldValue('roles');
    if (checked) {
      form.setFieldValue(
        'roles',
        current.includes(roleName) ? current : [...current, roleName]
      );
    } else {
      form.setFieldValue(
        'roles',
        current.filter((r) => r !== roleName)
      );
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.editTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="user-name">{t('account.name')}</FieldLabel>
            <Input disabled id="user-name" value={user.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="user-email">{t('account.email')}</FieldLabel>
            <Input disabled id="user-email" value={user.email} />
          </Field>
          <form.Field name="nickname">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('account.nickname')}
                </FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="cohortId">
            {(field) => (
              <Field>
                <FieldLabel>{t('preferences.cohort')}</FieldLabel>
                <Select
                  items={cohortItems}
                  onValueChange={(value) => field.handleChange(value ?? null)}
                  value={field.state.value ?? ''}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        cohortItems.length > 0
                          ? t('cohort.selectPlaceholder')
                          : t('cohort.noneFound')
                      }
                    />
                  </SelectTrigger>
                </Select>
              </Field>
            )}
          </form.Field>
          <Field>
            <FieldLabel>{t('users.roles')}</FieldLabel>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {selectedRoles.map((role: string) => (
                <Badge key={role} variant="default">
                  {role}
                </Badge>
              ))}
              {selectedRoles.length === 0 && (
                <span className="text-muted-foreground text-sm">
                  {t('users.noRoles')}
                </span>
              )}
            </div>
            {rolesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">
                {t('common.loading')}
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {availableRoles.map((role) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    htmlFor={`role-${role.name}`}
                    key={role.name}
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role.name)}
                      id={`role-${role.name}`}
                      onCheckedChange={(checked) =>
                        toggleRole(role.name, Boolean(checked))
                      }
                    />
                    {role.name}
                  </label>
                ))}
                {availableRoles.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    {t('users.noRoles')}
                  </p>
                )}
              </div>
            )}
          </Field>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={!form.state.canSubmit} type="submit">
              {t('users.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
