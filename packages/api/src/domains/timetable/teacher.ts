import z from 'zod';

/** A teacher row as returned by the admin list, with the linked user (if any). */
export const teacherListItemSchema = z.object({
  email: z.email().nullable(),
  firstName: z.string(),
  id: z.uuid(),
  lastName: z.string(),
  short: z.string(),
  user: z
    .object({
      email: z.email(),
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  userId: z.uuid().nullable(),
});

export type TeacherListItem = z.infer<typeof teacherListItemSchema>;

export const listTeachersResponseSchema = z.object({
  data: z.array(teacherListItemSchema),
  success: z.boolean(),
});

export type ListTeachersResponse = z.infer<typeof listTeachersResponseSchema>;

export const getTeacherParamsSchema = z.object({
  id: z.uuid(),
});

export type GetTeacherParamsInput = z.infer<typeof getTeacherParamsSchema>;

/** Manual overwrite of a teacher's email and/or linked user. */
export const updateTeacherPayload = z.object({
  email: z.email().nullable().optional(),
  userId: z.uuid().nullable().optional(),
});

export type UpdateTeacherInput = z.infer<typeof updateTeacherPayload>;
