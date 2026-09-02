import {
  getGroupsForCohortParamsSchema,
  groupResponseSchema,
  selectGroupRequestSchema,
  selectGroupResponseSchema,
} from '@filcdev/api/domains/timetable/groups';
import { deriveDivisionLabel } from '@filcdev/timetable-import/types';
import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { cohort, cohortGroup, userGroup } from '#database/schema/timetable';
import { requireAuthentication } from '#middleware/auth';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { timetableFactory } from './_factory';

const getForCohortResponseSchema = z.object({
  data: groupResponseSchema.array(),
  success: z.boolean(),
});

export const getGroupsForCohort = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Group', '@listof Group', true),
    description:
      'Get the groups of a cohort, marking the current user selection.',
    parameters: [
      {
        in: 'path',
        name: 'cohortId',
        required: true,
        schema: {
          description: 'The unique identifier for the cohort.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getForCohortResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Group'],
  }),
  zValidator('param', getGroupsForCohortParamsSchema),
  async (c) => {
    const { cohortId } = c.req.valid('param');
    const userId = c.get('user')?.id ?? null;

    const [existingCohort] = await db
      .select()
      .from(cohort)
      .where(eq(cohort.id, cohortId))
      .limit(1);

    if (!existingCohort) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Cohort not found',
      });
    }

    const rows = await db
      .select({
        divisionTag: cohortGroup.divisionTag,
        entireClass: cohortGroup.entireClass,
        id: cohortGroup.id,
        name: cohortGroup.name,
        studentCount: cohortGroup.studentCount,
        teacherId: cohortGroup.teacherId,
      })
      .from(cohortGroup)
      .where(eq(cohortGroup.cohortId, cohortId));

    const selected = new Set<string>();
    if (userId) {
      const memberships = await db
        .select({ groupId: userGroup.groupId })
        .from(userGroup)
        .innerJoin(cohortGroup, eq(cohortGroup.id, userGroup.groupId))
        .where(
          and(eq(userGroup.userId, userId), eq(cohortGroup.cohortId, cohortId))
        );
      for (const membership of memberships) {
        selected.add(membership.groupId);
      }
    }

    // One readable label per numeric division, so parallel groups of a split
    // (including gender / word-suffixed names that share a divisiontag) render
    // under a single heading in the picker.
    const labelByDivision = new Map<string, string>();
    for (const row of rows) {
      if (row.divisionTag && !labelByDivision.has(row.divisionTag)) {
        labelByDivision.set(
          row.divisionTag,
          deriveDivisionLabel(row.name, row.entireClass) ?? row.name
        );
      }
    }

    const data = rows.map((row) => ({
      ...row,
      divisionLabel: row.divisionTag
        ? (labelByDivision.get(row.divisionTag) ?? null)
        : null,
      selected: selected.has(row.id),
    }));
    return ok(c, data);
  }
);

export const selectGroup = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Group',
      '@object Group @field(.selectedGroupId, string) @field(.divisionTag, string)',
      true
    ),
    description:
      'Select the group the current user belongs to for a division. Replaces any previous membership in that division.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(selectGroupResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Group'],
  }),
  requireAuthentication,
  zValidator('json', selectGroupRequestSchema),
  async (c) => {
    const userId = c.get('user').id;
    const { groupId } = c.req.valid('json');

    const [group] = await db
      .select()
      .from(cohortGroup)
      .where(eq(cohortGroup.id, groupId))
      .limit(1);

    if (!group) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Group not found',
      });
    }
    if (!(group.cohortId && group.divisionTag)) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'This group has no division to select',
      });
    }

    // A student keeps exactly one group per division, so drop any previous
    // membership among the groups of the same cohort + division.
    const sameDivisionRows = await db
      .select({ id: cohortGroup.id })
      .from(cohortGroup)
      .where(
        and(
          eq(cohortGroup.cohortId, group.cohortId),
          eq(cohortGroup.divisionTag, group.divisionTag)
        )
      );
    const sameDivisionIds = sameDivisionRows.map((row) => row.id);
    if (sameDivisionIds.length) {
      await db
        .delete(userGroup)
        .where(
          and(
            eq(userGroup.userId, userId),
            inArray(userGroup.groupId, sameDivisionIds)
          )
        );
    }

    await db
      .insert(userGroup)
      .values({ groupId, userId })
      .onConflictDoNothing();

    return ok(c, {
      divisionTag: group.divisionTag,
      selectedGroupId: groupId,
    });
  }
);
