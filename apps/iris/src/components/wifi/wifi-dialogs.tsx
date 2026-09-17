import type {
  WifiDevice,
  WifiNas,
  WifiSpeedProfile,
  WifiUser,
} from '@filcdev/api/domains/wifi/admin';
import {
  wifiDeviceCreateSchema,
  wifiDeviceUpdateSchema,
  wifiNasCreateSchema,
  wifiNasUpdateSchema,
  wifiRoleSpeedProfileCreateSchema,
  type wifiRoleSpeedProfileSchema,
  wifiRoleSpeedProfileUpdateSchema,
  wifiSpeedProfileCreateSchema,
  wifiSpeedProfileUpdateSchema,
  wifiUserCreateSchema,
  wifiUserUpdateSchema,
} from '@filcdev/api/domains/wifi/admin';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { PasswordInput } from '@filcdev/ui/components/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { useForm, useStore } from '@tanstack/react-form';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type z from 'zod';
import { useRoles } from '@/hooks/admin-users';
import {
  useCreateWifiDevice,
  useCreateWifiNas,
  useCreateWifiRoleProfile,
  useCreateWifiSpeedProfile,
  useCreateWifiUser,
  useUpdateWifiDevice,
  useUpdateWifiNas,
  useUpdateWifiRoleProfile,
  useUpdateWifiSpeedProfile,
  useUpdateWifiUser,
  useWifiSpeedProfiles,
} from '@/hooks/wifi-admin';

export type BaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WifiUserDialog({
  user,
  open,
  onOpenChange,
}: BaseDialogProps & { user?: WifiUser }) {
  const { t } = useTranslation();
  const create = useCreateWifiUser({ onSaved: () => onOpenChange(false) });
  const update = useUpdateWifiUser({ onSaved: () => onOpenChange(false) });
  const isEditing = !!user;
  const bannedId = useId();

  const profilesQuery = useWifiSpeedProfiles();
  const profiles = profilesQuery.data ?? [];

  const form = useForm({
    defaultValues: {
      banned: user?.banned ?? false,
      comment: user?.comment ?? '',
      password: '',
      speedProfileId: user?.speedProfileId ?? null,
      username: user?.username ?? '',
    },
    onSubmit: ({ value }) => {
      // biome-ignore lint/suspicious/noExplicitAny: API workaround
      const payload: any = { ...value };
      if (!payload.password) {
        payload.password = undefined;
      }
      if (isEditing) {
        update.mutate({ id: user.id, json: payload });
      } else {
        create.mutate(payload);
      }
    },
    validators: {
      onChange: isEditing
        ? wifiUserUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API type mismatch workaround
          (wifiUserCreateSchema as any),
      onSubmit: isEditing
        ? wifiUserUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API type mismatch workaround
          (wifiUserCreateSchema as any),
    },
  });

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminUsers.editUser', 'Edit User')
              : t('wifiAdminUsers.addUser', 'Add User')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="username">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.username', 'Username')}
                </FieldLabel>
                <Input
                  disabled={isEditing}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field>
                <FieldLabel>{t('login.password', 'Password')}</FieldLabel>
                <PasswordInput
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={
                    isEditing
                      ? t('leaveBlankToKeep', 'Leave blank to keep current')
                      : ''
                  }
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="comment">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.comment', 'Comment')}
                </FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.commentHint', 'Only visible to admins')}
                </p>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="speedProfileId">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.speedProfile', 'Speed Profile')}
                </FieldLabel>
                <Select
                  items={[
                    {
                      label: t('wifiAdminProfiles.none', 'None'),
                      value: 'none',
                    },
                    ...profiles.map((p) => ({ label: p.name, value: p.id })),
                  ]}
                  onValueChange={(v) =>
                    field.handleChange(v === 'none' ? null : v)
                  }
                  value={field.state.value ?? 'none'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {isEditing && (
            <form.Field name="banned">
              {(field) => (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    checked={field.state.value}
                    id={bannedId}
                    onCheckedChange={(c) => field.handleChange(c === true)}
                  />
                  <label
                    className="font-medium text-sm leading-none"
                    htmlFor={bannedId}
                  >
                    {t('wifiAdminUsers.banned', 'Banned')}
                  </label>
                </div>
              )}
            </form.Field>
          )}

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('close', 'Close')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WifiDeviceDialog({
  device,
  wifiUserId,
  open,
  onOpenChange,
}: BaseDialogProps & { device?: WifiDevice; wifiUserId?: string | null }) {
  const { t } = useTranslation();
  const create = useCreateWifiDevice({ onSaved: () => onOpenChange(false) });
  const update = useUpdateWifiDevice({ onSaved: () => onOpenChange(false) });
  const isEditing = !!device;
  const bannedId = useId();

  const form = useForm({
    defaultValues: {
      adminNotes: device?.adminNotes ?? '',
      banned: device?.banned ?? false,
      macAddress: device?.macAddress
        ? (device.macAddress
            .replace(/[^0-9a-fA-F]/g, '')
            .match(/.{1,2}/g)
            ?.join(':') ?? device.macAddress)
        : '',
      nickname: device?.nickname ?? '',
      wifiUserId: device?.wifiUserId ?? wifiUserId ?? null,
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ id: device.id, json: value });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: isEditing
        ? wifiDeviceUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiDeviceCreateSchema as any),
      onSubmit: isEditing
        ? wifiDeviceUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiDeviceCreateSchema as any),
    },
  });

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminUsers.editDevice', 'Edit Device')
              : t('wifiAdminUsers.addDevice', 'Add Device / Ban')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="macAddress">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.deviceMac', 'MAC Address')}
                </FieldLabel>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="00:11:22:33:44:55"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="nickname">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.deviceNickname', 'Nickname')}
                </FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.nicknameHint', 'Visible to the user')}
                </p>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="adminNotes">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminUsers.comment', 'Comment')}
                </FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.commentHint', 'Only visible to admins')}
                </p>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="banned">
            {(field) => (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  checked={field.state.value}
                  id={bannedId}
                  onCheckedChange={(c) => field.handleChange(c === true)}
                />
                <label
                  className="font-medium text-sm leading-none"
                  htmlFor={bannedId}
                >
                  {t('wifiAdminUsers.bannedDevice', 'Banned Device')}
                </label>
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('close', 'Close')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WifiNasDialog({
  nas,
  open,
  onOpenChange,
}: BaseDialogProps & { nas?: WifiNas }) {
  const { t } = useTranslation();
  const create = useCreateWifiNas({ onSaved: () => onOpenChange(false) });
  const update = useUpdateWifiNas({ onSaved: () => onOpenChange(false) });
  const isEditing = !!nas;

  const form = useForm({
    defaultValues: {
      comment: nas?.comment ?? '',
      ipAddress: nas?.ipAddress ?? '',
      macAddress: nas?.macAddress
        ? (nas.macAddress
            .replace(/[^0-9a-fA-F]/g, '')
            .match(/.{1,2}/g)
            ?.join(':') ?? nas.macAddress)
        : '',
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ id: nas.id, json: value });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: isEditing
        ? wifiNasUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiNasCreateSchema as any),
      onSubmit: isEditing
        ? wifiNasUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiNasCreateSchema as any),
    },
  });

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminNas.editNas', 'Edit NAS')
              : t('wifiAdminNas.addNas', 'Add NAS')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="ipAddress">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminNas.ipAddress', 'IP Address')}
                </FieldLabel>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="192.168.1.100"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="macAddress">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminNas.macAddress', 'MAC Address')}
                </FieldLabel>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="00:11:22:33:44:55"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="comment">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminNas.comment', 'Comment')}</FieldLabel>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('close', 'Close')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WifiSpeedProfileDialog({
  profile,
  open,
  onOpenChange,
}: BaseDialogProps & { profile?: WifiSpeedProfile }) {
  const { t } = useTranslation();
  const create = useCreateWifiSpeedProfile({
    onSaved: () => onOpenChange(false),
  });
  const update = useUpdateWifiSpeedProfile({
    onSaved: () => onOpenChange(false),
  });
  const isEditing = !!profile;

  const form = useForm({
    defaultValues: {
      downloadSpeedMbps: profile?.downloadSpeedMbps ?? -1,
      name: profile?.name ?? '',
      uploadSpeedMbps: profile?.uploadSpeedMbps ?? -1,
    },
    onSubmit: ({ value }) => {
      const payload = {
        ...value,
        downloadSpeedMbps:
          value.downloadSpeedMbps === -1 ? null : value.downloadSpeedMbps,
        uploadSpeedMbps:
          value.uploadSpeedMbps === -1 ? null : value.uploadSpeedMbps,
      };
      if (isEditing) {
        // biome-ignore lint/suspicious/noExplicitAny: API workaround
        update.mutate({ id: profile.id, json: payload as any });
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: API workaround
        create.mutate(payload as any);
      }
    },
    validators: {
      onChange: isEditing
        ? wifiSpeedProfileUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiSpeedProfileCreateSchema as any),
      onSubmit: isEditing
        ? wifiSpeedProfileUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiSpeedProfileCreateSchema as any),
    },
  });

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminProfiles.editProfile', 'Edit Profile')
              : t('wifiAdminProfiles.addProfile', 'Create Profile')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.name', 'Name')}</FieldLabel>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="downloadSpeedMbps">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminProfiles.download', 'Download (Mbps)')}
                </FieldLabel>
                <Input
                  onChange={(e) =>
                    field.handleChange(Number.parseInt(e.target.value, 10))
                  }
                  type="number"
                  value={field.state.value}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  -1 for unlimited
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="uploadSpeedMbps">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminProfiles.upload', 'Upload (Mbps)')}
                </FieldLabel>
                <Input
                  onChange={(e) =>
                    field.handleChange(Number.parseInt(e.target.value, 10))
                  }
                  type="number"
                  value={field.state.value}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  -1 for unlimited
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('close', 'Close')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WifiRoleProfileDialog({
  mapping,
  open,
  onOpenChange,
}: BaseDialogProps & { mapping?: z.infer<typeof wifiRoleSpeedProfileSchema> }) {
  const { t } = useTranslation();
  const create = useCreateWifiRoleProfile({
    onSaved: () => onOpenChange(false),
  });
  const update = useUpdateWifiRoleProfile({
    onSaved: () => onOpenChange(false),
  });
  const isEditing = !!mapping;

  const rolesQuery = useRoles();
  const roles = rolesQuery.data?.roles ?? [];

  const profilesQuery = useWifiSpeedProfiles();
  const profiles = profilesQuery.data ?? [];

  const form = useForm({
    defaultValues: {
      downloadSpeedMbps: mapping?.downloadSpeedMbps ?? -1,
      priority: mapping?.priority ?? 0,
      roleName: mapping?.roleName ?? '',
      speedProfileId: mapping?.speedProfileId ?? '',
      uploadSpeedMbps: mapping?.uploadSpeedMbps ?? -1,
    },
    onSubmit: ({ value }) => {
      const payload = {
        ...value,
        downloadSpeedMbps:
          value.downloadSpeedMbps === -1 ? null : value.downloadSpeedMbps,
        uploadSpeedMbps:
          value.uploadSpeedMbps === -1 ? null : value.uploadSpeedMbps,
      };
      if (isEditing) {
        // biome-ignore lint/suspicious/noExplicitAny: API workaround
        update.mutate({ id: mapping.roleName, json: payload as any });
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: API workaround
        create.mutate(payload as any);
      }
    },
    validators: {
      onChange: isEditing
        ? wifiRoleSpeedProfileUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiRoleSpeedProfileCreateSchema as any),
      onSubmit: isEditing
        ? wifiRoleSpeedProfileUpdateSchema
        : // biome-ignore lint/suspicious/noExplicitAny: API workaround
          (wifiRoleSpeedProfileCreateSchema as any),
    },
  });

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminProfiles.editMapping', 'Edit Mapping')
              : t('wifiAdminProfiles.addMapping', 'Add Role Mapping')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="roleName">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminProfiles.roleName', 'Role')}
                </FieldLabel>
                <Select
                  disabled={isEditing}
                  onValueChange={(v) => field.handleChange(v ?? '')}
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="speedProfileId">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminProfiles.speedProfile', 'Profile')}
                </FieldLabel>
                <Select
                  onValueChange={(v) => field.handleChange(v ?? '')}
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {profiles.find((p) => p.id === field.state.value)?.name ??
                        field.state.value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="priority">
            {(field) => (
              <Field>
                <FieldLabel>
                  {t('wifiAdminProfiles.priority', 'Priority')}
                </FieldLabel>
                <Input
                  onChange={(e) =>
                    field.handleChange(Number.parseInt(e.target.value, 10))
                  }
                  type="number"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('close', 'Close')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
