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
  // Narrow month/day to the wire range, then require each pair to be a real
  // date: `02-29` passes both field schemas individually but a window that
  // repeats every year cannot mean a leap day, so the pair degrades to 01-01
  // like any other out-of-range value instead of being served with
  // phantom-ordinal semantics.
  const readPair = (month: number, day: number) => {
    const narrowed = {
      day: daySchema.catch(1).parse(day),
      month: monthSchema.catch(1).parse(month),
    };

    return isRealMonthDay(narrowed.month, narrowed.day)
      ? narrowed
      : { day: 1, month: 1 };
  };

  const start = readPair(row.startMonth, row.startDay);
  const end = readPair(row.endMonth, row.endDay);
  const window = {
    endDay: end.day,
    endMonth: end.month,
    startDay: start.day,
    startMonth: start.month,
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

type Tx = Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

/**
 * Serialise every schedule write, so the overlap check and the row it writes
 * see the same table.
 *
 * The isolation level matters and is therefore always passed explicitly
 * (`read committed`): it re-snapshots a statement after it has waited on a
 * lock, so rows committed by the transaction we queued behind are visible to
 * the check. Under `repeatable read` the overlap would be missed; a row lock is
 * no substitute either, because it locks no gap — two creates from an empty
 * table would both pass.
 */
const lockScheduleWrites = (tx: Tx) =>
  tx.execute(sql`lock table site_theme_schedule in share row exclusive mode`);

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

    const row = await db.transaction(
      async (tx) => {
        await lockScheduleWrites(tx);

        const siblings = await tx
          .select(scheduleWindowColumns)
          .from(siteThemeSchedule);
        const overlapping = siblings.find((sibling) =>
          windowsOverlap(sibling, input)
        );

        if (overlapping) {
          logger.warning(
            'theme schedule window rejected: overlaps another row',
            {
              candidate: input,
              conflictingId: overlapping.id,
              requestId: context.requestId,
              userId: context.user?.id,
            }
          );
          throw conflict(
            'This window overlaps another scheduled window. Windows must not overlap.'
          );
        }

        const [inserted] = await tx
          .insert(siteThemeSchedule)
          .values({ ...input, updatedBy: context.user?.id })
          .returning();

        return inserted;
      },
      { isolationLevel: 'read committed' }
    );

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

    // The row is read inside the transaction, under the lock, and `merged`, the
    // no-op check and the overlap check are all derived from that read. Reading
    // it outside would let two PATCHes of different fields start from the same
    // snapshot and the second silently revert the first.
    const result = await db.transaction(
      async (tx) => {
        await lockScheduleWrites(tx);

        const [existing] = await tx
          .select()
          .from(siteThemeSchedule)
          .where(eq(siteThemeSchedule.id, id))
          .limit(1);

        if (!existing) {
          return null;
        }

        const merged = {
          endDay: patch.endDay ?? existing.endDay,
          endMonth: patch.endMonth ?? existing.endMonth,
          startDay: patch.startDay ?? existing.startDay,
          startMonth: patch.startMonth ?? existing.startMonth,
          theme: patch.theme ?? existing.theme,
        };

        assertRealWindow(merged);

        // A PATCH that changes nothing is not a write: no row update, no
        // activity entry, same answer as the stored row.
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
          return { after: existing, before: existing, unchanged: true };
        }

        const siblings = await tx
          .select(scheduleWindowColumns)
          .from(siteThemeSchedule)
          .where(ne(siteThemeSchedule.id, id));
        const overlapping = siblings.find((sibling) =>
          windowsOverlap(sibling, merged)
        );

        if (overlapping) {
          logger.warning(
            'theme schedule window rejected: overlaps another row',
            {
              candidate: merged,
              conflictingId: overlapping.id,
              id,
              requestId: context.requestId,
              userId: context.user?.id,
            }
          );
          throw conflict(
            'This window overlaps another scheduled window. Windows must not overlap.'
          );
        }

        const [updated] = await tx
          .update(siteThemeSchedule)
          .set({
            ...merged,
            updatedAt: new Date(),
            updatedBy: context.user?.id,
          })
          .where(eq(siteThemeSchedule.id, id))
          .returning();

        // The read above already happened under this lock, so an empty
        // `returning` means the row is gone; answer it as a 404, never a 500.
        return updated
          ? { after: updated, before: existing, unchanged: false }
          : null;
      },
      { isolationLevel: 'read committed' }
    );

    if (!result) {
      logger.debug('theme schedule window not found', {
        id,
        requestId: context.requestId,
      });
      throw notFound('Theme schedule window not found');
    }

    if (result.unchanged) {
      return toScheduleItem(
        result.after,
        todayInTimeZone(new Date(), env.timeZone),
        context.requestId
      );
    }

    logger.info('theme schedule window updated', {
      after: {
        end: `${result.after.endMonth}-${result.after.endDay}`,
        start: `${result.after.startMonth}-${result.after.startDay}`,
        theme: result.after.theme,
      },
      before: {
        end: `${result.before.endMonth}-${result.before.endDay}`,
        start: `${result.before.startMonth}-${result.before.startDay}`,
        theme: result.before.theme,
      },
      id,
      requestId: context.requestId,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'site-theme-schedule',
      metadata: { after: result.after, before: result.before },
    });

    return toScheduleItem(
      result.after,
      todayInTimeZone(new Date(), env.timeZone),
      context.requestId
    );
  });

export const deleteThemeSchedule = base.theme.schedule.delete
  .use(requireAuthorization(permissions.siteThemeManage))
  .handler(async ({ context, input }) => {
    // A delete cannot create an overlap on its own, but it takes the same lock
    // as every other schedule write so "writes are serialised" stays true for
    // whatever reads or imports this table next.
    const row = await db.transaction(
      async (tx) => {
        await lockScheduleWrites(tx);

        const [deleted] = await tx
          .delete(siteThemeSchedule)
          .where(eq(siteThemeSchedule.id, input.id))
          .returning();

        return deleted;
      },
      { isolationLevel: 'read committed' }
    );

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
