import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

type User = NonNullable<
  InferResponseType<typeof api.users.index.$get>['data']
>['users'][number];

type UserDialogProps = BaseDialogProps & {
  user: User;
};

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.roles.index.$get());
      if (!res.success) {
        throw new Error('Failed to load roles');
      }
      return res.data;
    },
    queryKey: queryKeys.roles(),
  });

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data ?? [];
    },
    queryKey: queryKeys.cohorts(),
  });

  const cohortItems = (cohortsQuery.data ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const availableRoles = rolesQuery.data?.roles ?? [];

  const mutation = useMutation({
    mutationFn: async ({
      cohortId,
      nickname,
      roles,
    }: {
      cohortId: string | null;
      nickname: string;
      roles: string[];
    }) => {
      const res = await api.users[':id'].$patch({
        json: {
          cohortId,
          nickname: nickname || undefined,
          roles,
        },
        param: { id: user.id },
      });
      if (!res.ok) {
        throw new Error(t('users.updateError'));
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('users.updateError'));
    },
    onSuccess: () => {
      toast.success(t('users.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.usersAll() });
      onOpenChange(false);
    },
  });

  const form = useForm({
    defaultValues: {
      cohortId: user.cohortId ?? null,
      nickname: user.nickname ?? '',
      roles: user.roles as string[],
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
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
                  <SelectContent>
                    {cohortItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
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
