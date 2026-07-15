import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, count, desc, gte, isNotNull, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { role } from '#database/schema/authorization';
import { cohort, movedLesson, substitution } from '#database/schema/timetable';
import { dashboardFactory } from '#routes/dashboard/_factory';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { getActiveTimetableId } from '#utils/timetable/active';

const logger = getLogger(['chronos', 'dashboard']);

const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const chartPointSchema = z.object({
  date: z.string(),
  movedLessons: z.number().int(),
  substitutions: z.number().int(),
});

const dashboardStatsResponseSchema = z.object({
  data: z.object({
    stats: z.object({
      chartData: z.array(chartPointSchema),
      chartTotalMovedLessons: z.number().int(),
      chartTotalSubstitutions: z.number().int(),
      totalCohorts: z.number().int(),
      totalMovedLessons: z.number().int(),
      totalRoles: z.number().int(),
      totalSubstitutions: z.number().int(),
      totalUsers: z.number().int(),
    }),
  }),
  success: z.literal(true),
});

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const getDashboardStats = dashboardFactory.createHandlers(
  describeRoute({
    ...filcExt('Dashboard', '@unit DashboardStatsResponse'),
    description: 'Get aggregated dashboard statistics',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(dashboardStatsResponseSchema),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Dashboard'],
  }),
  zValidator('query', statsQuerySchema),
  async (c) => {
    try {
      const { days } = c.req.valid('query');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - days + 1);

      const [[usersRow], [cohortsRow], [rolesRow], relevantSubs, timetableId] =
        await Promise.all([
          db.select({ count: count() }).from(user),
          db.select({ count: count() }).from(cohort),
          db.select({ count: count() }).from(role),
          db
            .select({ date: substitution.date })
            .from(substitution)
            .where(
              and(
                gte(substitution.date, fromDate),
                lte(substitution.date, today),
                isNotNull(substitution.substituter)
              )
            )
            .orderBy(desc(substitution.date)),
          getActiveTimetableId(),
        ]);

      // Live counts: today + upcoming only, not affected by the days filter
      const [[liveSubsRow], [liveMovedRow]] = await Promise.all([
        db
          .select({ count: count() })
          .from(substitution)
          .where(
            and(
              gte(substitution.date, today),
              isNotNull(substitution.substituter)
            )
          ),
        timetableId
          ? db
              .select({ count: count() })
              .from(movedLesson)
              .where(gte(movedLesson.date, today))
          : Promise.resolve([{ count: 0 }]),
      ]);

      let movedLessonDates: { date: Date }[] = [];
      if (timetableId) {
        movedLessonDates = await db
          .select({ date: movedLesson.date })
          .from(movedLesson)
          .where(
            and(gte(movedLesson.date, fromDate), lte(movedLesson.date, today))
          );
      }

      const dateMap = new Map<
        string,
        { movedLessons: number; substitutions: number }
      >();

      for (const sub of relevantSubs) {
        const d = fmtDate(sub.date);
        const entry = dateMap.get(d) ?? { movedLessons: 0, substitutions: 0 };
        entry.substitutions += 1;
        dateMap.set(d, entry);
      }

      for (const m of movedLessonDates) {
        const d = fmtDate(m.date);
        const entry = dateMap.get(d) ?? { movedLessons: 0, substitutions: 0 };
        entry.movedLessons += 1;
        dateMap.set(d, entry);
      }

      const chartData = [...dateMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));

      return ok(c, {
        stats: {
          chartData,
          chartTotalMovedLessons: movedLessonDates.length,
          chartTotalSubstitutions: relevantSubs.length,
          totalCohorts: cohortsRow?.count ?? 0,
          totalMovedLessons: liveMovedRow?.count ?? 0,
          totalRoles: rolesRow?.count ?? 0,
          totalSubstitutions: liveSubsRow?.count ?? 0,
          totalUsers: usersRow?.count ?? 0,
        },
      });
    } catch (error) {
      logger.error('Error while fetching dashboard stats', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch dashboard stats',
      });
    }
  }
);
