/**
 * Shared type definitions for doorlock components.
 * API-derived types (InferResponseType etc.) remain co-located with their routes.
 */

export type DeviceOption = { id: string; name: string };

export type UserOption = {
  email: string | null;
  id: string;
  name: string | null;
  nickname?: string | null;
};

export type CardLike = {
  authorizedDevices: DeviceOption[];
  enabled: boolean;
  frozen: boolean;
  id: string;
  name: string;
  userId: string | null;
};

export type CardFormValues = {
  authorizedDeviceIds: string[];
  cardData: string;
  enabled: boolean;
  frozen: boolean;
  name: string;
  userId: string | null;
};

export type CardDialogProps<
  TCard extends CardLike = CardLike,
  TDevice extends DeviceOption = DeviceOption,
  TUser extends UserOption = UserOption,
> = {
  card?: TCard | null;
  devices: TDevice[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CardFormValues) => Promise<void>;
  open: boolean;
  users: TUser[];
};

export type DeviceLike = {
  apiToken: string;
  lastResetReason?: string | null;
  location?: string | null;
  name: string;
};

export type DeviceFormValues = {
  apiToken: string;
  lastResetReason?: string | null;
  location?: string | null;
  name: string;
};

export type DeviceDialogProps<TDevice extends DeviceLike = DeviceLike> = {
  device?: TDevice | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DeviceFormValues) => Promise<void>;
  open: boolean;
};
