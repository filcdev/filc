import { randomUUID } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { notification, userPreferences } from '#modules/notifications/schema';
import { lessonCohortMTM } from '#modules/timetable/schema';
import { linkedTeacherExists } from '#utils/notifications/channel-defaults';
import { enqueue } from '#utils/notifications/queue';
import type {
  AudienceUser,
  NotificationContent,
  NotificationHandler,
  NotificationPreferences,
  NotificationType,
} from '#utils/notifications/types';
import { completePreferences } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'engine']);

const registry = new Map<NotificationType, NotificationHandler>();
const timers = new Map<string, Timer>();

function timerKey(entityId: string, type: NotificationType): string {
  return `${type}:${entityId}`;
}

export function registerHandler<T>(handler: NotificationHandler<T>): void {
  registry.set(handler.type, handler as NotificationHandler);
  logger.debug('Registered handler for notification type: {type}', {
    type: handler.type,
  });
}

export function cancelPendingNotification(
  entityId: string,
  type: NotificationType
): void {
  const key = timerKey(entityId, type);
  const timer = timers.get(key);
  if (timer) {
    clearTimeout(timer);
    timers.delete(key);
    logger.debug('Cancelled pending notification: {key}', { key });
  }
}

export async function resolveAudienceForLessonChange(
  payload: unknown
): Promise<AudienceUser[]> {
  const p = payload as { lessonIds?: string[]; cohortIds?: string[] };
  const lessonIds = p.lessonIds ?? [];
  const manualCohortIds = p.cohortIds ?? [];

  if (lessonIds.length === 0 && manualCohortIds.length === 0) {
    return [];
  }

  const lessonCohorts = lessonIds.length
    ? await db
        .select({ cohortId: lessonCohortMTM.cohortId })
        .from(lessonCohortMTM)
        .where(inArray(lessonCohortMTM.lessonId, lessonIds))
    : [];

  const cohortIds = [
    ...new Set([...lessonCohorts.map((c) => c.cohortId), ...manualCohortIds]),
  ];

  if (cohortIds.length === 0) {
    return [];
  }

  return resolveAudienceByCohortIds(cohortIds);
}

async function resolveAudienceByCohortIds(
  cohortIds: string[]
): Promise<AudienceUser[]> {
  const users = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable)
    .where(inArray(userTable.cohortId, cohortIds));

  return enrichUsersWithLanguage(users);
}

export async function resolveAudienceByCohortOrAll(
  cohortIds?: string[]
): Promise<AudienceUser[]> {
  let users: { id: string; email: string; cohortId: string | null }[];
  if (!cohortIds || cohortIds.length === 0) {
    users = await db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
      })
      .from(userTable);
  } else {
    users = await db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
      })
      .from(userTable)
      .where(inArray(userTable.cohortId, cohortIds));
  }

  return enrichUsersWithLanguage(users);
}

export async function resolveAudienceForBlogPost(): Promise<AudienceUser[]> {
  const users = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable);

  return enrichUsersWithLanguage(users);
}

/**
 * The audience for a notification addressed to one user: that user, with their
 * stored language. Used by the types that notify a single person (a door-lock
 * card holder, a cohort that has to be reselected).
 */
export async function resolveAudienceForUser(
  payload: unknown
): Promise<AudienceUser[]> {
  const { userId } = payload as { userId: string };

  const [target] = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!target) {
    return [];
  }

  const [prefs] = await db
    .select({ language: userPreferences.language })
    .from(userPreferences)
    .where(eq(userPreferences.userId, target.id))
    .limit(1);

  return [
    {
      cohortId: target.cohortId,
      email: target.email,
      id: target.id,
      language: prefs?.language ?? 'hu',
    },
  ];
}

async function enrichUsersWithLanguage(
  users: { id: string; email: string; cohortId: string | null }[]
): Promise<AudienceUser[]> {
  if (users.length === 0) {
    return [];
  }

  const prefResults = await db
    .select()
    .from(userPreferences)
    .where(
      inArray(
        userPreferences.userId,
        users.map((u) => u.id)
      )
    );

  const prefMap = new Map(prefResults.map((p) => [p.userId, p]));

  return users.map((u) => {
    const prefs = prefMap.get(u.id);
    return {
      cohortId: u.cohortId,
      email: u.email,
      id: u.id,
      language: prefs?.language ?? 'hu',
    };
  });
}

/**
 * Preferences, channel flags and the actual write for one recipient. A
 * skipped user (type opted out, or every channel off) is a normal outcome,
 * not an error.
 */
async function deliverToUser(
  type: NotificationType,
  payload: unknown,
  handler: NotificationHandler,
  user: AudienceUser
): Promise<void> {
  // One row per recipient: the stored preferences and whether a teacher row
  // links this user, so the role-aware defaults below cost no extra query.
  const [row] = await db
    .select({
      hasTeacher: linkedTeacherExists(userTable.id),
      notificationPreferences: userPreferences.notificationPreferences,
    })
    .from(userTable)
    .leftJoin(userPreferences, eq(userPreferences.userId, userTable.id))
    .where(eq(userTable.id, user.id))
    .limit(1);

  // A user who never opened their settings has no row, and a row written
  // before a toggle existed lacks that key; both fall back per key rather
  // than reading `undefined`, which the gate below would treat as an
  // opt-out. The helper also resolves the legacy `channelsEnabled` switch, so
  // the per-channel flags read here are already the effective ones.
  const preferences: NotificationPreferences = completePreferences(
    row?.notificationPreferences,
    { email: row?.hasTeacher ?? false }
  );

  const prefKey = handler.preferenceKey;
  if (prefKey && !preferences[prefKey]) {
    logger.debug('User {userId} opted out of notification type {type}', {
      type,
      userId: user.id,
    });
    return;
  }

  const flags = {
    email: preferences.emailEnabled,
    inApp: preferences.inAppEnabled,
    push: preferences.pushEnabled,
  };
  if (!(flags.email || flags.push || flags.inApp)) {
    logger.debug('User {userId} disabled every channel for {type}', {
      type,
      userId: user.id,
    });
    return;
  }

  const content: NotificationContent = handler.buildContent(
    payload,
    user.language
  );

  let notificationId: string | undefined;
  if (flags.inApp) {
    const [notif] = await db
      .insert(notification)
      .values({
        content: content.content,
        metadata: content.metadata ?? null,
        title: content.title,
        type,
        userId: user.id,
      })
      .returning();
    notificationId = notif?.id;
  }

  // Email/push can be on while in-app is off, in which case there is no
  // inbox row; the id then only correlates the delivery's log lines.
  if (flags.email || flags.push) {
    enqueue({
      content: content.content,
      details: content.details,
      email: user.email,
      emailEnabled: flags.email,
      highlights: content.highlights,
      language: user.language,
      notificationId: notificationId ?? randomUUID(),
      pushEnabled: flags.push,
      title: content.title,
      type,
      userId: user.id,
    });
  }
}

async function fireNotification(
  type: NotificationType,
  payload: unknown
): Promise<void> {
  const handler = registry.get(type);
  if (!handler) {
    logger.warn('No handler registered for notification type: {type}', {
      type,
    });
    return;
  }

  try {
    const audience = await handler.getAudience(payload);

    if (audience.length === 0) {
      logger.debug('Empty audience for notification type: {type}', { type });
      return;
    }

    for (const user of audience) {
      await deliverToUser(type, payload, handler, user);
    }

    logger.info('Dispatched notification type {type} to {count} users', {
      count: audience.length,
      type,
    });
  } catch (error) {
    logger.error('Failed to dispatch notification type {type}', {
      error,
      type,
    });
  }
}

export function dispatchPendingNotification(
  entityId: string,
  type: NotificationType,
  payload: unknown
): void {
  cancelPendingNotification(entityId, type);

  const handler = registry.get(type);
  if (!handler) {
    logger.warn('No handler registered for notification type: {type}', {
      type,
    });
    return;
  }

  const delay = type === 'doorlock_card_used' ? 0 : handler.getDelay();
  const delayMs = delay * 1000;

  const key = timerKey(entityId, type);
  const timer = setTimeout(() => {
    timers.delete(key);
    fireNotification(type, payload).catch((err) => {
      logger.error('Notification fire failed for {key}: {error}', {
        error: err,
        key,
      });
    });
  }, delayMs);

  timers.set(key, timer);
  logger.debug(
    'Scheduled notification type {type} for entity {entityId} in {delay}s',
    {
      delay,
      entityId,
      type,
    }
  );
}

export function dispatchImmediateNotification(
  type: NotificationType,
  payload: unknown
): void {
  fireNotification(type, payload).catch((err) => {
    logger.error('Immediate notification fire failed: {error}', { error: err });
  });
}
