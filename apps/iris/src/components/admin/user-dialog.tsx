import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { parseResponse } from 'hono/client';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/utils/hc';

type User = InferResponseType<
  typeof api.users.index.$get
>['data']['users'][number];

type UserDialogProps = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState(user.nickname || '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.roles.index.$get());
      if (!res.success) {
        throw new Error('Failed to load roles');
      }
      return res.data;
    },
    queryKey: ['roles'],
  });

  const availableRoles = rolesQuery.data?.roles ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.users[':id'].$patch({
        json: {
          nickname: nickname || undefined,
          roles: selectedRoles,
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input disabled id="name" value={user.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input disabled id="email" value={user.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              onChange={(e) => setNickname(e.target.value)}
              value={nickname}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('roles.permissions')}</Label>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {selectedRoles.map((role) => (
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
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles((prev) => [...prev, role.name]);
                        } else {
                          setSelectedRoles((prev) =>
                            prev.filter((r) => r !== role.name)
                          );
                        }
                      }}
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
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t('common.cancel')}
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
