import { deriveDivisionLabel } from '@filcdev/timetable-import/types';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication } from '#middleware/auth';
import { cohort, cohortGroup, userGroup } from '#modules/timetable/schema';
import { base } from '#orpc';
import { badRequest, forbidden, notFound } from '#utils/http';

export const getGroupsForCohort = base.timetable.groups.getForCohort.handler(
  async ({ input, context }) => {
    const { cohortId } = input;
    const userId = context.user?.id ?? null;

    const [existingCohort] = await db
      .select()
      .from(cohort)
      .where(eq(cohort.id, cohortId))
      .limit(1);

    if (!existingCohort) {
      throw notFound('Cohort not found');
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
    return data;
  }
);

export const selectGroup = base.timetable.groups.select
  .use(requireAuthentication)
  .handler(async ({ input, context }) => {
    const userId = context.session.userId;
    const userCohortId = context.user?.cohortId ?? null;
    const { groupId } = input;

    const [group] = await db
      .select()
      .from(cohortGroup)
      .where(eq(cohortGroup.id, groupId))
      .limit(1);

    if (!group) {
      throw notFound('Group not found');
    }
    if (!(group.cohortId && group.divisionTag)) {
      throw badRequest('This group has no division to select');
    }
    // A caller can only pick a group in their own persisted cohort.
    if (group.cohortId !== userCohortId) {
      throw forbidden('This group does not belong to your cohort');
    }
    const cohortId = group.cohortId;
    const divisionTag = group.divisionTag;

    // A student keeps exactly one group per division, so drop any previous
    // membership among the groups of the same cohort + division. Run the
    // delete + insert in one transaction and lock the division's group rows so
    // two concurrent selections cannot both delete-then-insert (write skew).
    await db.transaction(async (tx) => {
      const divisionRows = await tx
        .select({ id: cohortGroup.id })
        .from(cohortGroup)
        .where(
          and(
            eq(cohortGroup.cohortId, cohortId),
            eq(cohortGroup.divisionTag, divisionTag)
          )
        )
        .for('update');

      const sameDivisionIds = divisionRows.map((row) => row.id);
      if (sameDivisionIds.length) {
        await tx
          .delete(userGroup)
          .where(
            and(
              eq(userGroup.userId, userId),
              inArray(userGroup.groupId, sameDivisionIds)
            )
          );
      }

      await tx
        .insert(userGroup)
        .values({ groupId, userId })
        .onConflictDoNothing();
    });

    return {
      divisionTag,
      selectedGroupId: groupId,
    };
  });
