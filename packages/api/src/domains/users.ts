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
