import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { notification, userPreferences } from '#database/schema/notifications';
import { lessonCohortMTM } from '#database/schema/timetable';
import { enqueue } from '#utils/notifications/queue';
import type {
  AudienceUser,
  NotificationContent,
  NotificationHandler,
  NotificationType,
} from '#utils/notifications/types';

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

async function resolveAudienceForLessonChange(
  payload: unknown
): Promise<AudienceUser[]> {
  const p = payload as { lessonIds?: string[] };
  if (!p.lessonIds || p.lessonIds.length === 0) {
    return [];
  }

  const cohortResults = await db
    .select({ cohortId: lessonCohortMTM.cohortId })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.lessonId, p.lessonIds));

  const cohortIds = [...new Set(cohortResults.map((c) => c.cohortId))];

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

async function resolveAudienceByCohortOrAll(
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

async function resolveAudienceForBlogPost(): Promise<AudienceUser[]> {
  const users = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable);

  return enrichUsersWithLanguage(users);
}

async function resolveAudienceForDoorlock(
  payload: unknown
): Promise<AudienceUser[]> {
  const p = payload as { userId: string };
  const userResult = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable)
    .where(eq(userTable.id, p.userId))
    .limit(1);

  const u = userResult[0];
  if (!u) {
    return [];
  }

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, u.id))
    .limit(1);

  return [
    {
      cohortId: u.cohortId,
      email: u.email,
      id: u.id,
      language: prefs?.language ?? 'hu',
    },
  ];
}

async function resolveAudienceForCohortReselection(
  payload: unknown
): Promise<AudienceUser[]> {
  const p = payload as { userId: string };
  const [targetUser] = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable)
    .where(eq(userTable.id, p.userId))
    .limit(1);

  if (!targetUser) {
    return [];
  }

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, targetUser.id))
    .limit(1);

  return [
    {
      cohortId: targetUser.cohortId,
      email: targetUser.email,
      id: targetUser.id,
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

const audienceResolvers: Record<
  string,
  (payload: unknown) => Promise<AudienceUser[]>
> = {
  announcement: (p) =>
    resolveAudienceByCohortOrAll((p as { cohortIds?: string[] }).cohortIds),
  blog_post: () => resolveAudienceForBlogPost(),
  cohort_reselection_required: resolveAudienceForCohortReselection,
  doorlock_card_used: resolveAudienceForDoorlock,
  moved_lesson: resolveAudienceForLessonChange,
  substitution: resolveAudienceForLessonChange,
  system_message: (p) =>
    resolveAudienceByCohortOrAll((p as { cohortIds?: string[] }).cohortIds),
};

const preferenceKeys: Record<
  string,
  keyof {
    substitution: boolean;
    movedLesson: boolean;
    announcement: boolean;
    systemMessage: boolean;
    blogPost: boolean;
    doorlockCardUsed: boolean;
  }
> = {
  announcement: 'announcement',
  blog_post: 'blogPost',
  doorlock_card_used: 'doorlockCardUsed',
  moved_lesson: 'movedLesson',
  substitution: 'substitution',
  system_message: 'systemMessage',
};

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
    const resolver = audienceResolvers[type];
    const audience = resolver
      ? await resolver(payload)
      : await handler.getAudience(payload);

    if (audience.length === 0) {
      logger.debug('Empty audience for notification type: {type}', { type });
      return;
    }

    for (const user of audience) {
      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);

      const prefKey = preferenceKeys[type];
      if (prefs && prefKey && !prefs.notificationPreferences[prefKey]) {
        logger.debug('User {userId} opted out of notification type {type}', {
          type,
          userId: user.id,
        });
        continue;
      }

      const channelsEnabled =
        prefs?.notificationPreferences.channelsEnabled ?? true;
      const content: NotificationContent = handler.buildContent(
        payload,
        user.language
      );

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

      if (notif) {
        enqueue({
          channelsEnabled,
          content: content.content,
          email: user.email,
          notificationId: notif.id,
          title: content.title,
          type,
          userId: user.id,
        });
      }
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
