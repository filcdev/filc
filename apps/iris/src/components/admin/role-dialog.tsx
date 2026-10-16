import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@filcdev/ui/components/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { cn } from '@filcdev/ui/lib/utils';
import { useForm, useStore } from '@tanstack/react-form';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Role,
  useCreateRole,
  usePermissions,
  useUpdateRole,
} from '@/hooks/admin-users';
import type { BaseDialogProps } from './admin.types';

type RoleDialogProps = BaseDialogProps & {
  editingRole: Role | null;
};

const ROLE_NAME_REGEX = /^[a-z0-9_-]+$/;

export function RoleDialog({
  editingRole,
  open,
  onOpenChange,
}: RoleDialogProps) {
  const { t } = useTranslation();
  const isEditing = editingRole !== null;
  const [permissionInput, setPermissionInput] = useState('');
  const [permissions, setPermissions] = useState<string[]>(
    editingRole?.can ?? []
  );
  const permissionsQuery = usePermissions();

  const knownPermissions = permissionsQuery.data ?? [];

  const form = useForm({
    defaultValues: { name: editingRole?.name ?? '' },
    onSubmit: ({ value }) => {
      if (isEditing) {
        updateRole.mutate({ name: editingRole.name, permissions });
      } else {
        createRole.mutate({ name: value.name, permissions });
      }
    },
  });

  const createRole = useCreateRole({ onSaved: () => onOpenChange(false) });
  const updateRole = useUpdateRole({ onSaved: () => onOpenChange(false) });

  const handleAddPermission = () => {
    const trimmed = permissionInput.trim();
    if (trimmed && !permissions.includes(trimmed)) {
      setPermissions([...permissions, trimmed]);
      setPermissionInput('');
    }
  };

  const handleRemovePermission = (perm: string) => {
    setPermissions(permissions.filter((p) => p !== perm));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddPermission();
    }
  };

  const allKnownPermissionsSelected =
    knownPermissions.length > 0 &&
    knownPermissions.every((permission) => permissions.includes(permission));

  const toggleAllKnownPermissions = () => {
    if (allKnownPermissionsSelected) {
      setPermissions((current) =>
        current.filter((permission) => !knownPermissions.includes(permission))
      );
      return;
    }
    setPermissions((current) => [
      ...new Set([...current, ...knownPermissions]),
    ]);
  };

  const isPending = createRole.isPending || updateRole.isPending;

  const nameValue = useStore(form.store, (state) => state.values.name);
  const isNameValid = ROLE_NAME_REGEX.test(nameValue) && nameValue.length > 0;
  const permissionSet = new Set(permissions);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('roles.editRole') : t('roles.createRole')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{t('roles.name')}</FieldLabel>
                <Input
                  disabled={isEditing}
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. moderator"
                  value={field.state.value}
                />
                {!isEditing && field.state.value.length > 0 && !isNameValid && (
                  <FieldError errors={[t('roles.nameValidation')]} />
                )}
              </Field>
            )}
          </form.Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>{t('roles.permissions')}</FieldLabel>
              <Button
                disabled={knownPermissions.length === 0}
                onClick={toggleAllKnownPermissions}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(
                  allKnownPermissionsSelected
                    ? 'roles.deselectAllPermissions'
                    : 'roles.selectAllPermissions'
                )}
              </Button>
            </div>
            <PermissionChips
              onRemove={handleRemovePermission}
              permissions={permissions}
            />
            <Command className="rounded-lg border" shouldFilter>
              <CommandInput
                onValueChange={setPermissionInput}
                placeholder={t('roles.searchOrAddPermission')}
                value={permissionInput}
              />
              <CommandList className="max-h-40">
                <CommandEmpty>
                  {permissionInput.trim() ? (
                    <Button
                      className="text-sm"
                      onClick={handleAddPermission}
                      size="sm"
                      variant="ghost"
                    >
                      {t('roles.addCustom', { name: permissionInput.trim() })}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {t('roles.noPermissions')}
                    </span>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {knownPermissions.map((perm) => {
                    const selected = permissionSet.has(perm);
                    return (
                      <CommandItem
                        key={perm}
                        onSelect={() => {
                          if (selected) {
                            handleRemovePermission(perm);
                          } else {
                            setPermissions((prev) => [...prev, perm]);
                          }
                        }}
                        value={perm}
                      >
                        <CheckIcon
                          className={cn(
                            'size-4 shrink-0',
                            selected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {perm}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="flex gap-2">
              <Input
                onChange={(e) => setPermissionInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('roles.customPermissionPlaceholder')}
                value={permissionInput}
              />
              <Button
                disabled={!permissionInput.trim()}
                onClick={handleAddPermission}
                size="sm"
                type="button"
                variant="outline"
              >
                {t('roles.addPermission')}
              </Button>
            </div>
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
              disabled={isPending || !(isEditing || isNameValid)}
              type="submit"
            >
              {isPending
                ? t('common.loading')
                : t(isEditing ? 'roles.save' : 'roles.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The permissions picked so far, each removable by clicking it. */
function PermissionChips({
  onRemove,
  permissions,
}: {
  onRemove: (permission: string) => void;
  permissions: string[];
}) {
  const { t } = useTranslation();

  if (permissions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('roles.noPermissions')}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {permissions.map((perm) => (
        <Badge
          className="cursor-pointer"
          key={perm}
          onClick={() => onRemove(perm)}
          variant="secondary"
        >
          {perm} ✕
        </Badge>
      ))}
    </div>
  );
}
