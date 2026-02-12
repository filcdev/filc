import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/utils/hc';

type Role = {
  name: string;
  can: string[];
};

type RoleDialogProps = {
  editingRole: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROLE_NAME_REGEX = /^[a-z0-9_-]+$/;

export function RoleDialog({
  editingRole,
  open,
  onOpenChange,
}: RoleDialogProps) {
  const { t } = useTranslation();
  const isEditing = editingRole !== null;
  const [name, setName] = useState('');
  const [permissionInput, setPermissionInput] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(editingRole?.name ?? '');
      setPermissions(editingRole?.can ?? []);
      setPermissionInput('');
    }
  }, [open, editingRole]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.roles.index.$post({
        json: {
          name,
          permissions,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to create role');
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('roles.createError'));
    },
    onSuccess: () => {
      toast.success(t('roles.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.roles[':name'].$patch({
        json: { permissions },
        param: { name: editingRole?.name ?? '' },
      });
      if (!res.ok) {
        throw new Error('Failed to update role');
      }
      return res.json();
    },
    onError: () => {
      toast.error(t('roles.updateError'));
    },
    onSuccess: () => {
      toast.success(t('roles.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
  });

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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPermission();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isNameValid = ROLE_NAME_REGEX.test(name) && name.length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('roles.editRole') : t('roles.createRole')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">{t('roles.name')}</Label>
            <Input
              disabled={isEditing}
              id="role-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. moderator"
              value={name}
            />
            {!isEditing && name.length > 0 && !isNameValid && (
              <p className="text-destructive text-sm">
                {t('roles.nameValidation')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('roles.permissions')}</Label>
            <div className="flex gap-2">
              <Input
                id="permission-input"
                onChange={(e) => setPermissionInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. users:manage"
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
            {permissions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {permissions.map((perm) => (
                  <Badge
                    className="cursor-pointer"
                    key={perm}
                    onClick={() => handleRemovePermission(perm)}
                    variant="secondary"
                  >
                    {perm} ✕
                  </Badge>
                ))}
              </div>
            )}
            {permissions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t('roles.noPermissions')}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t('common.cancel')}
          </Button>
          <Button
            disabled={isPending || !(isEditing || isNameValid)}
            onClick={handleSave}
          >
            {isPending
              ? t('common.loading')
              : t(isEditing ? 'roles.save' : 'roles.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
