import { getLogger } from '@logtape/logtape';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { db } from '~/database';
import {
  cohort,
  lesson,
  lessonCohortMTM,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '~/database/schema/timetable';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { timetableFactory } from '../_factory';

const logger = getLogger(['chronos', 'substitutions']);

export const getAllSubstitutions = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const substitutions = await db
        .select({
          substitution,
          teacher,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessons'),
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId)
        )
        .groupBy(substitution.id, teacher.id);

      return c.json({
        status: 'success',
        data: substitutions,
      });
    } catch (error) {
      logger.error('Error while fetching all substitutions', { error });
      return c.json(
        {
          status: 'error',
          message: 'Failed to fetch substitutions',
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export const getRelevantSubstitutions = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const substitutions = await db
        .select({
          substitution,
          teacher,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessons'),
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId)
        )
        .where(gte(substitution.date, today as string))
        .groupBy(substitution.id, teacher.id);

      return c.json({
        status: 'success',
        data: substitutions,
      });
    } catch (error) {
      logger.error('Error while fetching substitutions', { error });
      return c.json(
        {
          status: 'error',
          message: 'Failed to fetch relevant substitutions',
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export const getRelevantSubstitutionsForCohort =
  timetableFactory.createHandlers(requireAuthentication, async (c) => {
    try {
      const cohortId = c.req.param('cohortId');

      if (!cohortId) {
        return c.json(
          {
            status: 'error',
            message: 'Cohort ID is required',
          },
          StatusCodes.BAD_REQUEST
        );
      }

      const today = new Date().toISOString().split('T')[0];

      const substitutions = await db
        .select({
          substitution,
          teacher,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessons'),
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId)
        )
        .leftJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
        .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
        .leftJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
        .where(
          and(gte(substitution.date, today as string), eq(cohort.id, cohortId))
        )
        .groupBy(substitution.id, teacher.id);

      return c.json({
        status: 'success',
        data: substitutions,
        cohortId,
      });
    } catch (error) {
      logger.error('Error while fetching substitutions for cohort', { error });
      return c.json(
        {
          status: 'error',
          message: 'Failed to fetch substitutions for cohort',
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  });

export const createSubstitution = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('substitution:create'),
  async (c) => {
    const body = (await c.req.json()) as {
      date: string;
      lessonIds: string[];
      substituter?: string;
    };

    const { lessonIds, date, substituter } = body;

    if (!(lessonIds && date)) {
      return c.json(
        {
          status: 'error',
          message: `missing data in ${JSON.stringify(body)}`,
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const dateAsDateType = new Date(date);
    if (Number.isNaN(dateAsDateType.getTime())) {
      return c.json(
        {
          status: 'error',
          message: 'Invalid date format.',
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const lessonCount = await db.$count(lesson, inArray(lesson.id, lessonIds));

    if (lessonCount !== lessonIds.length) {
      return c.json(
        {
          status: 'error',
          message: `attempted to substitute non-existent lesson(s), wanted: ${lessonIds.length}, got: ${lessonCount}`,
        },
        StatusCodes.BAD_REQUEST
      );
    }

    // Use a transaction to create the substitution and the many-to-many relationships
    const result = await db.transaction(async (tx) => {
      const [insertedSubstitution] = await tx
        .insert(substitution)
        .values({
          id: crypto.randomUUID(),
          date,
          substituter,
        })
        .returning();

      if (!insertedSubstitution) {
        throw new Error('Failed to insert substitution');
      }

      // Insert the many-to-many relationships
      const mtmValues = lessonIds.map((lessonId) => ({
        substitutionId: insertedSubstitution.id,
        lessonId,
      }));

      await tx.insert(substitutionLessonMTM).values(mtmValues);

      return insertedSubstitution;
    });

    return c.json(
      {
        status: 'success',
        message: result,
      },
      StatusCodes.OK
    );
  }
);

export const updateSubstitution = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('substitution:update'),
  async (c) => {
    try {
      const id = c.req.param('id');
      const body = (await c.req.json()) as {
        date?: string;
        lessonIds?: string[];
        substituter?: string;
      };

      if (!id) {
        return c.json(
          {
            status: 'error',
            message: 'Substitution ID is required',
          },
          StatusCodes.BAD_REQUEST
        );
      }

      const existingSubstitution = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (existingSubstitution.length === 0) {
        return c.json(
          {
            status: 'error',
            message: 'Substitution not found',
          },
          StatusCodes.NOT_FOUND
        );
      }

      if (body.date) {
        const dateAsDate = new Date(body.date);
        if (Number.isNaN(dateAsDate.getTime())) {
          return c.json(
            {
              status: 'error',
              message: 'Invalid date format',
            },
            StatusCodes.BAD_REQUEST
          );
        }
      }

      if (body.lessonIds) {
        const lessonCount = await db.$count(
          lesson,
          inArray(lesson.id, body.lessonIds)
        );
        if (lessonCount !== body.lessonIds.length) {
          return c.json(
            {
              status: 'error',
              message: `Some lessons don't exist, wanted: ${body.lessonIds.length}, found: ${lessonCount}`,
            },
            StatusCodes.BAD_REQUEST
          );
        }
      }

      // Use a transaction to update the substitution and the many-to-many relationships
      const updatedSubstitution = await db.transaction(async (tx) => {
        // Update the substitution (excluding lessonIds)
        const updateData = { ...body };
        updateData.lessonIds = undefined;

        const [updated] = await tx
          .update(substitution)
          .set(updateData)
          .where(eq(substitution.id, id))
          .returning();

        // If lessonIds were provided, update the many-to-many relationships
        if (body.lessonIds) {
          // Delete existing relationships
          await tx
            .delete(substitutionLessonMTM)
            .where(eq(substitutionLessonMTM.substitutionId, id));

          // Insert new relationships
          const mtmValues = body.lessonIds.map((lessonId) => ({
            substitutionId: id,
            lessonId,
          }));

          await tx.insert(substitutionLessonMTM).values(mtmValues);
        }

        return updated;
      });

      return c.json({
        status: 'success',
        data: updatedSubstitution,
        message: 'Substitution updated successfully',
      });
    } catch (error) {
      logger.error('Error while updating substitution', { error });
      return c.json(
        {
          status: 'error',
          message: 'Failed to update substitution',
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export const deleteSubstitution = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('substitution:delete'),
  async (c) => {
    try {
      const id = c.req.param('id');

      if (!id) {
        return c.json(
          {
            status: 'error',
            message: 'Substitution ID is required',
          },
          StatusCodes.BAD_REQUEST
        );
      }

      const existingSubstitution = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (existingSubstitution.length === 0) {
        return c.json(
          {
            status: 'error',
            message: 'Substitution not found',
          },
          StatusCodes.NOT_FOUND
        );
      }

      // The many-to-many relationships will be automatically deleted due to the CASCADE constraint
      const [deletedSubstitution] = await db
        .delete(substitution)
        .where(eq(substitution.id, id))
        .returning();

      return c.json({
        status: 'success',
        data: deletedSubstitution,
        message: 'Substitution deleted successfully',
      });
    } catch (error) {
      logger.error('Error while deleting substitution', { error });
      return c.json(
        {
          status: 'error',
          message: 'Failed to delete substitution',
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);
