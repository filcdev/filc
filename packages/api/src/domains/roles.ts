import z from 'zod';

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9_-]+$/,
      'Role name must be lowercase alphanumeric with dashes or underscores'
    ),
  permissions: z.array(z.string()).default([]),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  permissions: z.array(z.string()),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const roleNameParamsSchema = z.object({ name: z.string() });

export type RoleNameParams = z.infer<typeof roleNameParamsSchema>;

/** Path + body for `PATCH /roles/{name}`. */
export const updateRoleInputSchema = roleNameParamsSchema.extend({
  permissions: updateRoleSchema.shape.permissions,
});

/** A role with its capability list, as the admin UI sees it. */
export const roleWithCapabilitiesSchema = z.object({
  can: z.array(z.string()),
  name: z.string(),
});

/** Response payload for listing roles. */
export const rolesListResponseSchema = z.object({
  roles: z.array(roleWithCapabilitiesSchema),
});

/** Response payload for listing every registered permission. */
export const permissionsListResponseSchema = z.object({
  permissions: z.array(z.string()),
});
