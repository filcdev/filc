import z from 'zod';

export const getGroupsForCohortParamsSchema = z.object({
  cohortId: z.uuid(),
});

export type GetGroupsForCohortParamsInput = z.infer<
  typeof getGroupsForCohortParamsSchema
>;

export const groupResponseSchema = z.object({
  divisionLabel: z.string().nullable(),
  divisionTag: z.string().nullable(),
  entireClass: z.boolean(),
  id: z.uuid(),
  name: z.string(),
  selected: z.boolean(),
  studentCount: z.number().nullable(),
  teacherId: z.string().nullable(),
});

export type GroupResponseInput = z.infer<typeof groupResponseSchema>;

export const selectGroupRequestSchema = z.object({
  groupId: z.uuid(),
});

export type SelectGroupRequestInput = z.infer<typeof selectGroupRequestSchema>;

export const selectGroupResponseSchema = z.object({
  data: z.object({
    divisionTag: z.string().nullable(),
    selectedGroupId: z.uuid().nullable(),
  }),
  success: z.boolean(),
});

export type SelectGroupResponseInput = z.infer<
  typeof selectGroupResponseSchema
>;
