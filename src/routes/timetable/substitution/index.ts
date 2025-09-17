import { getLogger } from '@logtape/logtape';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { db } from '~/database';
import { lesson, substitution, teacher } from '~/database/schema/timetable';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { timetableFactory } from '../_factory';

const logger = getLogger(['chronos', 'timetable']);

export const getAllSubstitutions = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const substitutions = await db
        .select()
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id));

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
        .select()
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .where(gte(substitution.date, today as string));

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
        .select()
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .where(gte(substitution.date, today as string));

      const relevantSubstitutions: typeof substitutions = [];

      for (const sub of substitutions) {
        const lessonCount = await db.$count(
          lesson,
          and(
            inArray(lesson.id, sub.substitution.lessonIds),
            sql`${cohortId} = ANY(cohort_ids)`
          )
        );

        if (lessonCount > 0) {
          relevantSubstitutions.push(sub);
        }
      }

      return c.json({
        status: 'success',
        data: relevantSubstitutions,
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
      substituter: string;
    };

    const { lessonIds, date, substituter } = body;

    if (!(lessonIds && date)) {
      return c.json(
        {
          status: 'error',
          message: `missing data in ${body}`,
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const date_as_datetype = new Date(date);
    if (Number.isNaN(date_as_datetype.getDate())) {
      return c.json(
        {
          status: 'error',
          message: 'Invalid date format.',
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const lesson_count = await db.$count(lesson, inArray(lesson.id, lessonIds));

    if (lesson_count !== lessonIds.length) {
      return c.json(
        {
          status: 'error',
          message: `attempted to substitute non-existant lesson(s), wanted: ${lessonIds.length}, got: ${lesson_count}`,
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const [insertedSubstitution] = await db
      .insert(substitution)
      .values({
        id: crypto.randomUUID(),
        date,
        lessonIds,
        substituter,
      })
      .returning();

    if (!insertedSubstitution) {
      return c.json(
        {
          status: 'error',
          message: `Failed to insert substitution: ${body}`,
        },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    return c.json(
      {
        status: 'success',
        message: insertedSubstitution,
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
        if (Number.isNaN(dateAsDate.getDate())) {
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

      const [updatedSubstitution] = await db
        .update(substitution)
        .set(body)
        .where(eq(substitution.id, id))
        .returning();

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
