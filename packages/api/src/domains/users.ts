import z from 'zod';
import { listResponse } from './list';

/** Query parameters for listing users. */
export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  role: z.string().optional(),
  search: z.string().optional(),
});

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

/** Payload for updating a user's profile and roles. */
export const userUpdatePayload = z.object({
  cohortId: z.uuid().nullable().optional(),
  nickname: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdatePayload>;

/** Path + body for `PATCH /users/{id}`. */
export const updateUserInputSchema = userUpdatePayload.extend({
  id: z.uuid(),
});

/**
 * Avatars are content-addressed: the object is stored under the SHA-256 of its
 * bytes, so the same picture always yields the same name. A replacement
 * therefore gets a new URL instead of invalidating a cached one, and two users
 * with the same picture share a single object.
 */
export const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Uploads above this are refused; the profile dialog states the limit. */
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/** Where Chronos serves a stored avatar from; the stored `user.image` value. */
export const AVATAR_URL_PREFIX = '/api/users/avatars/';

export const avatarUrl = (fileName: string): string =>
  `${AVATAR_URL_PREFIX}${fileName}`;

/** `<sha256>.<ext>` — the only object name the serving route accepts. */
export const avatarFileNameSchema = z
  .string()
  .regex(/^[0-9a-f]{64}\.(?:jpg|png|webp)$/);

/**
 * The avatar upload body. Only the presence of a file is checked here: the size
 * cap and the mime allowlist are enforced by the route, because zod's file
 * schema validates neither.
 */
export const avatarUploadSchema = z.object({ file: z.file() });

/** The avatar file name, as a path parameter. */
export const avatarFileInputSchema = z.object({ file: avatarFileNameSchema });

/** What an avatar write answers with: the affected user and its stored URL. */
export const userAvatarSchema = z.object({
  id: z.uuid(),
  image: z.string().nullable(),
});

export type UserAvatar = z.infer<typeof userAvatarSchema>;

/** A user row, as stored in the `user` table. */
export const userSelectSchema = z.object({
  cohortId: z.uuid().nullable(),
  createdAt: z.date(),
  email: z.string(),
  emailVerified: z.boolean(),
  id: z.uuid(),
  image: z.string().nullable(),
  name: z.string(),
  nickname: z.string().nullable(),
  roles: z.array(z.string()),
  updatedAt: z.date(),
});

/** A user as the admin UI sees them: the row plus display name and effective permissions. */
export const userWithPermissionsSchema = userSelectSchema.extend({
  displayName: z.string(),
  permissions: z.array(z.string()),
});

export type UserWithPermissions = z.infer<typeof userWithPermissionsSchema>;

/** Response payload for listing users. */
export const usersListResponseSchema = listResponse(userWithPermissionsSchema);
