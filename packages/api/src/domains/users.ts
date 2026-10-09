import z from 'zod';

/** Query parameters for listing users. */
export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

/** Payload for updating a user's profile and roles. */
export const userUpdatePayload = z.object({
  cohortId: z.string().nullable().optional(),
  nickname: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdatePayload>;

/** Path + body for `PATCH /users/{id}`. */
export const updateUserInputSchema = userUpdatePayload.extend({
  id: z.uuid(),
});

/** A user row, as stored in the `user` table. */
export const userSelectSchema = z.object({
  cohortId: z.string().nullable(),
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
export const usersListResponseSchema = z.object({
  total: z.number(),
  users: z.array(userWithPermissionsSchema),
});
