import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { eventCheckinConfig, eventRegistration } from '#modules/events/schema';
import { assertCheckinRules } from '#modules/events/utils/door-rules';
import { eventFields } from '#modules/events/utils/events';
import { requireEvent } from '#modules/events/utils/participants';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'checkin-configs']);

/** The helper whose name rides along with an override; null for the default. */
const helper = alias(user, 'helper');

const configColumns = {
  createdAt: eventCheckinConfig.createdAt,
  eventId: eventCheckinConfig.eventId,
  id: eventCheckinConfig.id,
  rules: eventCheckinConfig.rules,
  updatedAt: eventCheckinConfig.updatedAt,
  userId: eventCheckinConfig.userId,
  userName: helper.name,
};

/** Every config of one event, the default first, then helpers by name. */
const selectConfigs = (eventId: string) =>
  db
    .select(configColumns)
    .from(eventCheckinConfig)
    .leftJoin(helper, eq(eventCheckinConfig.userId, helper.id))
    .where(eq(eventCheckinConfig.eventId, eventId))
    .orderBy(sql`${eventCheckinConfig.userId} is null desc`, helper.name);

/** One config by its scanner; `null` is the event default row. */
const selectConfig = (eventId: string, userId: string | null) =>
  db
    .select(configColumns)
    .from(eventCheckinConfig)
    .leftJoin(helper, eq(eventCheckinConfig.userId, helper.id))
    .where(
      and(
        eq(eventCheckinConfig.eventId, eventId),
        userId === null
          ? isNull(eventCheckinConfig.userId)
          : eq(eventCheckinConfig.userId, userId)
      )
    )
    .limit(1);

/**
 * The door configurations of one event: its default plus one row per helper
 * with an override, each carrying the helper's name so the picker needs no
 * second read.
 */
export const listCheckinConfigs = base.events.checkinConfigs.list
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    await requireEvent(input.id);

    const items = await selectConfigs(input.id);

    logger.debug('door configs read', {
      eventId: input.id,
      helpers: items.filter((item) => item.userId !== null).length,
      requestId: context.requestId,
      returned: items.length,
    });

    return { items, total: items.length };
  });

/**
 * Write one scanner's rules. A null `userId` writes the event default, a set
 * one an approved helper's override; both are upserts, so saving twice keeps
 * one row. The two partial unique indexes are what the conflict target names.
 */
export const upsertCheckinConfig = base.events.checkinConfigs.upsert
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id, rules, userId } = input;

    await requireEvent(id);
    assertCheckinRules(await eventFields(id), rules);

    if (userId !== null) {
      // An override belongs to an approved helper of this event; a config for
      // anyone else would be a row nothing ever reads.
      const [approved] = await db
        .select({ id: eventRegistration.id })
        .from(eventRegistration)
        .where(
          and(
            eq(eventRegistration.eventId, id),
            eq(eventRegistration.userId, userId),
            eq(eventRegistration.role, 'helper'),
            eq(eventRegistration.status, 'confirmed')
          )
        )
        .limit(1);
      if (!approved) {
        throw badRequest('The door config belongs to an approved helper');
      }
    }

    await db
      .insert(eventCheckinConfig)
      .values({ eventId: id, rules, userId })
      .onConflictDoUpdate({
        set: { rules, updatedAt: new Date() },
        target:
          userId === null
            ? eventCheckinConfig.eventId
            : [eventCheckinConfig.eventId, eventCheckinConfig.userId],
        targetWhere:
          userId === null
            ? sql`${eventCheckinConfig.userId} is null`
            : sql`${eventCheckinConfig.userId} is not null`,
      });

    const [saved] = await selectConfig(id, userId);
    if (!saved) {
      throw notFound('Door config not found');
    }

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: { after: { checkinRules: rules }, userId },
    });

    logger.info('door config saved', {
      eventId: id,
      requestId: context.requestId,
      ruleCount: rules.length,
      userId,
    });

    return saved;
  });

/**
 * Drop a helper's override, resetting their next scan to the event default.
 * The default row itself is not deletable: an event without one would quietly
 * fall back to admitting everyone.
 */
export const deleteCheckinConfig = base.events.checkinConfigs.delete
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id, userId } = input;

    await requireEvent(id);

    const [gone] = await db
      .delete(eventCheckinConfig)
      .where(
        and(
          eq(eventCheckinConfig.eventId, id),
          eq(eventCheckinConfig.userId, userId)
        )
      )
      .returning({
        id: eventCheckinConfig.id,
        rules: eventCheckinConfig.rules,
      });

    if (!gone) {
      throw notFound('This helper uses the event default');
    }

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: { before: { checkinRules: gone.rules }, userId },
    });

    logger.info('door config reset to the event default', {
      eventId: id,
      requestId: context.requestId,
      userId,
    });

    return { id: gone.id };
  });
