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
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

type User = InferResponseType<
  typeof api.users.index.$get
>['data']['users'][number];

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

  const availableRoles = rolesQuery.data?.roles ?? [];

  const mutation = useMutation({
    mutationFn: async ({
      nickname,
      roles,
    }: {
      nickname: string;
      roles: string[];
    }) => {
      const res = await api.users[':id'].$patch({
        json: {
          nickname: nickname || undefined,
          roles,
        },
        param: { id: user.id },
      });
      if (!res.ok) {
        toast.error('Failed to update user');
      }
      return res.json();
    },
    onError: () => {
      toast.error('Failed to update user');
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.usersAll() });
      onOpenChange(false);
    },
  });

  const form = useForm({
    defaultValues: {
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
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="user-name">Name</FieldLabel>
            <Input disabled id="user-name" value={user.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="user-email">Email</FieldLabel>
            <Input disabled id="user-email" value={user.email} />
          </Field>
          <form.Field name="nickname">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Nickname</FieldLabel>
                <Input
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <Field>
            <FieldLabel>{t('roles.permissions')}</FieldLabel>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {selectedRoles.map((role: string) => (
                <Badge key={role} variant="default">
                  {role}
                </Badge>
              ))}
              {selectedRoles.length === 0 && (
                <span className="text-muted-foreground text-sm">
                  {t('roles.noRoles')}
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
                    {t('roles.noRoles')}
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
