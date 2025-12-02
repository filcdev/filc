import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { useState } from 'react';
import { toast } from 'sonner';
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

type User = InferResponseType<
  typeof api.users.index.$get
>['data']['users'][number];

type UserDialogProps = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const [nickname, setNickname] = useState(user.nickname || '');
  const [roles, setRoles] = useState(user.roles.join(', '));
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.users[':id'].$patch({
        json: {
          nickname: nickname || undefined,
          roles: roles
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean),
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
            <Label htmlFor="roles">Roles (comma separated)</Label>
            <Input
              id="roles"
              onChange={(e) => setRoles(e.target.value)}
              value={roles}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
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
