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
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { useForm, useStore } from '@tanstack/react-form';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
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
  type WifiDevice,
  type WifiNas,
  type WifiRoleSpeedProfile,
  type WifiSpeedProfile,
  type WifiUser,
} from '@/hooks/wifi-admin';
import {
  wifiDeviceFormSchema,
  wifiNasFormSchema,
  wifiRoleProfileFormSchema,
  wifiSpeedProfileFormSchema,
  wifiUserFormValidator,
} from '@/utils/form-schemas';

/** `-1` is the controller's "unlimited"; the API takes it as-is. */
const UNLIMITED = -1;

/** Canonical `aa:bb:cc:dd:ee:ff` for an input that may be unseparated. */
const formatMac = (mac: string | null | undefined): string =>
  mac
    ? (mac
        .replace(/[^0-9a-fA-F]/g, '')
        .match(/.{1,2}/g)
        ?.join(':') ?? mac)
    : '';

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
  // One stable schema per mode: TanStack Form takes a single schema, and a
  // ternary between two shapes is not assignable to it.
  const userValidator = useMemo(
    () => wifiUserFormValidator(isEditing),
    [isEditing]
  );

  const profilesQuery = useWifiSpeedProfiles();
  const profileItems = [
    { label: t('wifiAdminProfiles.none'), value: 'none' },
    ...(profilesQuery.data?.speedProfiles ?? []).map((profile) => ({
      label: profile.name,
      value: profile.id,
    })),
  ];

  const form = useForm({
    defaultValues: {
      banned: user?.banned ?? false,
      comment: user?.comment ?? '',
      password: '',
      speedProfileId: user?.speedProfileId ?? null,
      username: user?.username ?? '',
    },
    onSubmit: ({ value }) => {
      const payload = {
        ...value,
        // The update schema reads `''` as "keep the current password".
        password: value.password === '' ? undefined : value.password,
      };
      if (isEditing) {
        update.mutate({ ...payload, id: user.id });
      } else {
        create.mutate({
          ...payload,
          password: payload.password ?? '',
        });
      }
    },
    validators: {
      onChange: userValidator,
      onSubmit: userValidator,
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminUsers.editUser')
              : t('wifiAdminUsers.addUser')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="username">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminUsers.username')}</FieldLabel>
                <Input
                  disabled={isEditing}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifi.password')}</FieldLabel>
                <PasswordInput
                  hidePasswordLabel={t('common.hidePassword')}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={
                    isEditing ? t('wifiAdminUsers.leaveBlankToKeep') : ''
                  }
                  showPasswordLabel={t('common.showPassword')}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="comment">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminUsers.comment')}</FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.commentHint')}
                </p>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="speedProfileId">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminUsers.speedProfile')}</FieldLabel>
                <Select
                  items={profileItems}
                  onValueChange={(value) =>
                    field.handleChange(value === 'none' ? null : value)
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
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <label
                    className="font-medium text-sm leading-none"
                    htmlFor={bannedId}
                  >
                    {t('wifiAdminUsers.banned')}
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
              {t('common.cancel')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('common.save')}
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
      macAddress: formatMac(device?.macAddress),
      nickname: device?.nickname ?? '',
      wifiUserId: device?.wifiUserId ?? wifiUserId ?? null,
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ ...value, id: device.id });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: wifiDeviceFormSchema,
      onSubmit: wifiDeviceFormSchema,
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminUsers.editDevice')
              : t('wifiAdminUsers.addDevice')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="macAddress">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminUsers.deviceMac')}</FieldLabel>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
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
                <FieldLabel>{t('wifiAdminUsers.deviceNickname')}</FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.nicknameHint')}
                </p>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value ?? ''}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="adminNotes">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminUsers.comment')}</FieldLabel>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminUsers.commentHint')}
                </p>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
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
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <label
                  className="font-medium text-sm leading-none"
                  htmlFor={bannedId}
                >
                  {t('wifiAdminUsers.bannedDevice')}
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
              {t('common.cancel')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('common.save')}
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
      macAddress: formatMac(nas?.macAddress),
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ ...value, id: nas.id });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: wifiNasFormSchema,
      onSubmit: wifiNasFormSchema,
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('wifiAdminNas.editNas') : t('wifiAdminNas.addNas')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="ipAddress">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminNas.ipAddress')}</FieldLabel>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
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
                <FieldLabel>{t('wifiAdminNas.macAddress')}</FieldLabel>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
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
                <FieldLabel>{t('wifiAdminNas.comment')}</FieldLabel>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
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
              {t('common.cancel')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('common.save')}
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
      downloadSpeedMbps: profile?.downloadSpeedMbps ?? UNLIMITED,
      name: profile?.name ?? '',
      uploadSpeedMbps: profile?.uploadSpeedMbps ?? UNLIMITED,
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ ...value, id: profile.id });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: wifiSpeedProfileFormSchema,
      onSubmit: wifiSpeedProfileFormSchema,
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminProfiles.editProfile')
              : t('wifiAdminProfiles.addProfile')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.name')}</FieldLabel>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="downloadSpeedMbps">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.download')}</FieldLabel>
                <Input
                  onChange={(event) =>
                    field.handleChange(
                      Number.parseInt(event.target.value, 10) || UNLIMITED
                    )
                  }
                  type="number"
                  value={field.state.value}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminProfiles.unlimitedHint')}
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="uploadSpeedMbps">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.upload')}</FieldLabel>
                <Input
                  onChange={(event) =>
                    field.handleChange(
                      Number.parseInt(event.target.value, 10) || UNLIMITED
                    )
                  }
                  type="number"
                  value={field.state.value}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('wifiAdminProfiles.unlimitedHint')}
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
              {t('common.cancel')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('common.save')}
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
}: BaseDialogProps & { mapping?: WifiRoleSpeedProfile }) {
  const { t } = useTranslation();
  const create = useCreateWifiRoleProfile({
    onSaved: () => onOpenChange(false),
  });
  const update = useUpdateWifiRoleProfile({
    onSaved: () => onOpenChange(false),
  });
  const isEditing = !!mapping;

  const rolesQuery = useRoles();
  const roleItems = (rolesQuery.data?.roles ?? []).map((role) => ({
    label: role.name,
    value: role.name,
  }));

  const profilesQuery = useWifiSpeedProfiles();
  const profileItems = (profilesQuery.data?.speedProfiles ?? []).map(
    (profile) => ({ label: profile.name, value: profile.id })
  );

  const form = useForm({
    defaultValues: {
      priority: mapping?.priority ?? 0,
      roleName: mapping?.roleName ?? '',
      speedProfileId: mapping?.speedProfileId ?? '',
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        update.mutate({ ...value, id: mapping.roleName });
      } else {
        create.mutate(value);
      }
    },
    validators: {
      onChange: wifiRoleProfileFormSchema,
      onSubmit: wifiRoleProfileFormSchema,
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('wifiAdminProfiles.editMapping')
              : t('wifiAdminProfiles.addMapping')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="roleName">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.roleName')}</FieldLabel>
                <Select
                  disabled={isEditing}
                  items={roleItems}
                  onValueChange={(value) => field.handleChange(value ?? '')}
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="speedProfileId">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.speedProfile')}</FieldLabel>
                <Select
                  items={profileItems}
                  onValueChange={(value) => field.handleChange(value ?? '')}
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="priority">
            {(field) => (
              <Field>
                <FieldLabel>{t('wifiAdminProfiles.priority')}</FieldLabel>
                <Input
                  onChange={(event) =>
                    field.handleChange(
                      Number.parseInt(event.target.value, 10) || 0
                    )
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
              {t('common.cancel')}
            </Button>
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
