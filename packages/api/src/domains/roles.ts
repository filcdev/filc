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
