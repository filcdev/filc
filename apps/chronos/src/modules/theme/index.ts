import {
  daySchema,
  monthSchema,
  type SiteTheme,
  siteThemeSchema,
} from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq, ne, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { siteTheme, siteThemeSchedule } from '#modules/theme/schema';
import {
  type CalendarDay,
  isRealMonthDay,
  resolveTheme,
  todayInTimeZone,
  windowContains,
  windowsOverlap,
} from '#modules/theme/utils/schedule';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, conflict, notFound } from '#utils/http';

const logger = getLogger(['chronos', 'theme']);

type ScheduleRow = typeof siteThemeSchedule.$inferSelect;

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
 * The columns are plain integers and text that the writers restrict to real
 * dates and the skin enum, so the stored values *should* be valid. Narrow them
 * anyway, the same way `GET /theme` narrows its theme: one hand-edited row
 * (`start_month = 13`, an unknown skin) must degrade to a harmless window
 * instead of failing the response schema and 500ing the admin list.
 */
const toScheduleItem = (
  row: ScheduleRow,
  today: CalendarDay,
  requestId?: string
) => {
  const window = {
    endDay: daySchema.catch(1).parse(row.endDay),
    endMonth: monthSchema.catch(1).parse(row.endMonth),
    startDay: daySchema.catch(1).parse(row.startDay),
    startMonth: monthSchema.catch(1).parse(row.startMonth),
  };
  const theme = siteThemeSchema.catch('default').parse(row.theme);

  const degraded =
    theme !== row.theme ||
    window.endDay !== row.endDay ||
    window.endMonth !== row.endMonth ||
    window.startDay !== row.startDay ||
    window.startMonth !== row.startMonth;

  if (degraded) {
    logger.warning('theme schedule row is out of range, degrading it', {
      id: row.id,
      requestId,
      stored: row,
    });
  }

  return {
    active: windowContains(window, today.month, today.day),
    ...window,
    id: row.id,
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
 * The skin the site should wear today. Readable without a session because
 * signed-out visitors render it.
 *
 * The annual schedule is resolved here, per request, in three steps: Easter
 * (code), then the row whose window contains today, then the manually pinned
 * value. There is no cron job and no stored "current theme" — a schedule change
 * takes effect on the next read.
 */
export const getSiteTheme = base.theme.get.handler(async ({ context }) => {
  const today = todayInTimeZone(new Date(), env.timeZone);

  // Two reads on every first paint: the singleton manual row and the handful of
  // schedule rows. Both are primary-key-sized, so they stay cheaper than any
  // cache that could go stale between a window boundary and an admin edit.
  const [stored] = await db
    .select({ theme: siteTheme.theme })
    .from(siteTheme)
    .where(eq(siteTheme.id, 'default'))
    .limit(1);
  // Ordered so "the first matching row" is a stable answer even if a
  // hand-edited row ever overlaps another.
  const rows = await db
    .select(scheduleWindowColumns)
    .from(siteThemeSchedule)
    .orderBy(siteThemeSchedule.startMonth, siteThemeSchedule.startDay);

  const resolved = resolveTheme(stored?.theme ?? 'default', rows, today);

  // Both sources are plain text and every writer restricts them to the enum, so
  // the value *should* be a known skin. Narrow it anyway: this call is in every
  // visitor's first paint, and one bad value (a manual edit, a future writer
  // that forgets the enum) would otherwise fail the output schema and take the
  // whole page down instead of falling back to the everyday look.
  const theme = siteThemeSchema.catch('default').parse(resolved.theme);

  if (theme !== resolved.theme) {
    logger.warning('site theme is not a known skin, serving the default', {
      requestId: context.requestId,
      source: resolved.source,
      stored: resolved.theme,
    });
  }

  logger.debug('site theme read', {
    requestId: context.requestId,
    source: resolved.source,
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
    const today = todayInTimeZone(new Date(), env.timeZone);
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

    const row = await db.transaction(async (tx) => {
      // Serialise schedule writes: the overlap check and the insert have to see
      // the same table, or two concurrent creates both pass the check and the
      // invariant is gone. A row lock cannot do that — `select … for update`
      // locks zero rows on an empty table, which is exactly the first two
      // creates a school ever makes — so take a table lock in the mode that
      // conflicts with INSERT/UPDATE/DELETE and leaves readers untouched.
      await tx.execute(
        sql`lock table site_theme_schedule in share row exclusive mode`
      );

      const siblings = await tx
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

      const [inserted] = await tx
        .insert(siteThemeSchedule)
        .values({ ...input, updatedBy: context.user?.id })
        .returning();

      return inserted;
    });

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

    return toScheduleItem(
      row,
      todayInTimeZone(new Date(), env.timeZone),
      context.requestId
    );
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

    // A PATCH that changes nothing is not a write: no row update, no activity
    // entry, same answer as the stored row.
    const unchanged =
      merged.endDay === existing.endDay &&
      merged.endMonth === existing.endMonth &&
      merged.startDay === existing.startDay &&
      merged.startMonth === existing.startMonth &&
      merged.theme === existing.theme;

    if (unchanged) {
      logger.debug('theme schedule window unchanged', {
        id,
        requestId: context.requestId,
        userId: context.user?.id,
      });
      return toScheduleItem(
        existing,
        todayInTimeZone(new Date(), env.timeZone),
        context.requestId
      );
    }

    const row = await db.transaction(async (tx) => {
      // Same table lock as create: the merged window is checked against a table
      // no other write can modify until this transaction ends.
      await tx.execute(
        sql`lock table site_theme_schedule in share row exclusive mode`
      );

      const siblings = await tx
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

      const [updated] = await tx
        .update(siteThemeSchedule)
        .set({ ...merged, updatedAt: new Date(), updatedBy: context.user?.id })
        .where(eq(siteThemeSchedule.id, id))
        .returning();

      return updated;
    });

    // The row can disappear between the read above and this write; `returning`
    // is empty then, and dereferencing it would be a 500 instead of the 404 the
    // caller's next attempt would get anyway.
    if (!row) {
      logger.debug('theme schedule window vanished during update', {
        id,
        requestId: context.requestId,
      });
      throw notFound('Theme schedule window not found');
    }

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

    return toScheduleItem(
      row,
      todayInTimeZone(new Date(), env.timeZone),
      context.requestId
    );
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
