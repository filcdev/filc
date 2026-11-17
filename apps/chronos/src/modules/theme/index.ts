import { type SiteTheme, siteThemeSchema } from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq, ne } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { siteTheme, siteThemeSchedule } from '#modules/theme/schema';
import {
  activeThemeFor,
  type CalendarDay,
  isRealMonthDay,
  windowContains,
  windowsOverlap,
} from '#modules/theme/utils/schedule';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, conflict, notFound } from '#utils/http';
import { getZonedDateTimeParts } from '#utils/time-zone';

const logger = getLogger(['chronos', 'theme']);

type ScheduleRow = typeof siteThemeSchedule.$inferSelect;

/** Today as the school's wall clock sees it — the date every window is measured
 *  against. `CHRONOS_TIME_ZONE` is configuration, not UTC, because "is it
 *  Christmas yet" is a local-calendar question. */
const todayInSchoolTimeZone = (): CalendarDay => {
  const { day, month, year } = getZonedDateTimeParts(new Date(), env.timeZone);

  return { day: Number(day), month: Number(month), year: Number(year) };
};

/** The columns the resolver needs, in a stable order for log readability. */
const scheduleWindowColumns = {
  endDay: siteThemeSchedule.endDay,
  endMonth: siteThemeSchedule.endMonth,
  id: siteThemeSchedule.id,
  startDay: siteThemeSchedule.startDay,
  startMonth: siteThemeSchedule.startMonth,
  theme: siteThemeSchedule.theme,
};

/**
 * One row of the table, as every schedule endpoint answers it: the stored
 * columns plus `active`, computed against today.
 *
 * The column is plain text and the writers restrict it to the enum, so the
 * stored value *should* be a known skin. Narrow it anyway, the way `GET /theme`
 * does, so one bad row (a manual edit, a future writer that forgets the enum)
 * degrades to the default skin instead of failing the response schema.
 */
const toScheduleItem = (
  row: ScheduleRow,
  today: CalendarDay,
  requestId?: string
) => {
  const theme = siteThemeSchema.catch('default').parse(row.theme);

  if (theme !== row.theme) {
    logger.warning(
      'theme schedule row is not a known skin, reporting default',
      {
        id: row.id,
        requestId,
        stored: row.theme,
      }
    );
  }

  return {
    active: windowContains(row, today.month, today.day),
    endDay: row.endDay,
    endMonth: row.endMonth,
    id: row.id,
    startDay: row.startDay,
    startMonth: row.startMonth,
    theme,
  };
};

/** `start`/`end` of a window, rejected when either is not a real calendar day. */
const assertRealWindow = (window: {
  endDay: number;
  endMonth: number;
  startDay: number;
  startMonth: number;
}) => {
  if (!isRealMonthDay(window.startMonth, window.startDay)) {
    throw badRequest(
      `The window start ${window.startMonth}-${window.startDay} is not a real date`
    );
  }
  if (!isRealMonthDay(window.endMonth, window.endDay)) {
    throw badRequest(
      `The window end ${window.endMonth}-${window.endDay} is not a real date`
    );
  }
};

/**
 * The one row the table holds, or the default when it has never been set.
 * Readable without a session because signed-out visitors render the skin.
 *
 * The annual schedule is resolved here, per request, in three steps: Easter
 * (code), then the row whose window contains today, then the manually pinned
 * value. There is no cron job and no stored "current theme" — a schedule change
 * takes effect on the next read.
 */
export const getSiteTheme = base.theme.get.handler(async ({ context }) => {
  const today = todayInSchoolTimeZone();
  const rows = await db.select(scheduleWindowColumns).from(siteThemeSchedule);
  const scheduled = activeThemeFor(rows, today);

  if (scheduled !== null) {
    const parsed = siteThemeSchema.safeParse(scheduled);

    if (parsed.success) {
      logger.debug('site theme read', {
        requestId: context.requestId,
        source: 'schedule',
        theme: parsed.data,
      });
      return { theme: parsed.data };
    }

    logger.warning(
      'scheduled theme is not a known skin, serving the manual pick',
      { requestId: context.requestId, stored: scheduled }
    );
  }

  const [row] = await db
    .select({ theme: siteTheme.theme })
    .from(siteTheme)
    .where(eq(siteTheme.id, 'default'))
    .limit(1);

  // The column is plain text and the only writer restricts it to the enum, so
  // the stored value *should* be one of them. Narrow it anyway: this call is in
  // every visitor's first paint, and one bad row (a manual edit, a future
  // writer that forgets the enum) would otherwise fail the output schema and
  // take the whole page down instead of falling back to the everyday look.
  const theme = siteThemeSchema.catch('default').parse(row?.theme);

  if (row && theme !== row.theme) {
    logger.warning('site theme row is not a known skin, serving the default', {
      requestId: context.requestId,
      stored: row.theme,
    });
  }

  logger.debug('site theme read', {
    requestId: context.requestId,
    source: 'manual',
    theme,
  });

  return { theme };
});

export const updateSiteTheme = base.theme.update
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context, input }) => {
    const { theme } = input;

    const [existing] = await db
      .select({ theme: siteTheme.theme })
      .from(siteTheme)
      .where(eq(siteTheme.id, 'default'))
      .limit(1);

    const before = (existing?.theme ?? 'default') as SiteTheme;

    if (before === theme) {
      logger.debug('site theme unchanged', {
        requestId: context.requestId,
        theme,
        userId: context.user?.id,
      });
      return { theme };
    }

    const [row] = await db
      .insert(siteTheme)
      .values({ id: 'default', theme, updatedBy: context.user?.id })
      .onConflictDoUpdate({
        set: { theme, updatedAt: new Date(), updatedBy: context.user?.id },
        target: siteTheme.id,
      })
      .returning({ theme: siteTheme.theme });

    logger.info('site theme updated', {
      from: before,
      requestId: context.requestId,
      to: theme,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: 'default',
      entityType: 'site-theme',
      metadata: { after: theme, before },
    });

    return { theme: row.theme as SiteTheme };
  });

/** The schedule, earliest window first, each row flagged when active today. */
export const listThemeSchedule = base.theme.schedule.list
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context }) => {
    const today = todayInSchoolTimeZone();
    const rows = await db
      .select()
      .from(siteThemeSchedule)
      .orderBy(siteThemeSchedule.startMonth, siteThemeSchedule.startDay);

    const items = rows.map((row) =>
      toScheduleItem(row, today, context.requestId)
    );

    logger.debug('theme schedule listed', {
      active: items.filter((item) => item.active).length,
      requestId: context.requestId,
      total: items.length,
      userId: context.user?.id,
    });

    return { items, total: items.length };
  });

export const createThemeSchedule = base.theme.schedule.create
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context, input }) => {
    assertRealWindow(input);

    const siblings = await db
      .select(scheduleWindowColumns)
      .from(siteThemeSchedule);
    const overlapping = siblings.find((sibling) =>
      windowsOverlap(sibling, input)
    );

    if (overlapping) {
      logger.warning('theme schedule window rejected: overlaps another row', {
        candidate: input,
        conflictingId: overlapping.id,
        requestId: context.requestId,
        userId: context.user?.id,
      });
      throw conflict(
        'This window overlaps another scheduled window. Windows must not overlap.'
      );
    }

    const [row] = await db
      .insert(siteThemeSchedule)
      .values({ ...input, updatedBy: context.user?.id })
      .returning();

    logger.info('theme schedule window created', {
      end: `${row.endMonth}-${row.endDay}`,
      id: row.id,
      requestId: context.requestId,
      start: `${row.startMonth}-${row.startDay}`,
      theme: row.theme,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'create',
      entityId: row.id,
      entityType: 'site-theme-schedule',
      metadata: { after: row },
    });

    return toScheduleItem(row, todayInSchoolTimeZone(), context.requestId);
  });

export const updateThemeSchedule = base.theme.schedule.update
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context, input }) => {
    const { id, ...patch } = input;

    const [existing] = await db
      .select()
      .from(siteThemeSchedule)
      .where(eq(siteThemeSchedule.id, id))
      .limit(1);

    if (!existing) {
      logger.debug('theme schedule window not found', {
        id,
        requestId: context.requestId,
      });
      throw notFound('Theme schedule window not found');
    }

    const merged = {
      endDay: patch.endDay ?? existing.endDay,
      endMonth: patch.endMonth ?? existing.endMonth,
      startDay: patch.startDay ?? existing.startDay,
      startMonth: patch.startMonth ?? existing.startMonth,
      theme: patch.theme ?? existing.theme,
    };

    assertRealWindow(merged);

    const siblings = await db
      .select(scheduleWindowColumns)
      .from(siteThemeSchedule)
      .where(ne(siteThemeSchedule.id, id));
    const overlapping = siblings.find((sibling) =>
      windowsOverlap(sibling, merged)
    );

    if (overlapping) {
      logger.warning('theme schedule window rejected: overlaps another row', {
        candidate: merged,
        conflictingId: overlapping.id,
        id,
        requestId: context.requestId,
        userId: context.user?.id,
      });
      throw conflict(
        'This window overlaps another scheduled window. Windows must not overlap.'
      );
    }

    const [row] = await db
      .update(siteThemeSchedule)
      .set({ ...merged, updatedAt: new Date(), updatedBy: context.user?.id })
      .where(eq(siteThemeSchedule.id, id))
      .returning();

    logger.info('theme schedule window updated', {
      after: merged,
      before: {
        end: `${existing.endMonth}-${existing.endDay}`,
        start: `${existing.startMonth}-${existing.startDay}`,
        theme: existing.theme,
      },
      id,
      requestId: context.requestId,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'site-theme-schedule',
      metadata: { after: row, before: existing },
    });

    return toScheduleItem(row, todayInSchoolTimeZone(), context.requestId);
  });

export const deleteThemeSchedule = base.theme.schedule.delete
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context, input }) => {
    const [row] = await db
      .delete(siteThemeSchedule)
      .where(eq(siteThemeSchedule.id, input.id))
      .returning();

    if (!row) {
      logger.debug('theme schedule window not found for delete', {
        id: input.id,
        requestId: context.requestId,
      });
      throw notFound('Theme schedule window not found');
    }

    logger.info('theme schedule window deleted', {
      end: `${row.endMonth}-${row.endDay}`,
      id: row.id,
      requestId: context.requestId,
      start: `${row.startMonth}-${row.startDay}`,
      theme: row.theme,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'delete',
      entityId: row.id,
      entityType: 'site-theme-schedule',
      metadata: { before: row },
    });

    return { id: row.id };
  });
