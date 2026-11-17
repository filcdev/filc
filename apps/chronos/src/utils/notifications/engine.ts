import { randomUUID } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import { and, eq, inArray, not } from 'drizzle-orm';
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
import {
  completePreferences,
  isNotificationAllowed,
  resolveEmailAllowed,
} from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'engine']);

const registry = new Map<NotificationType, NotificationHandler>();
// Known limit: the debounce state is process-local and in-memory. A restart
// inside a delay window (deploy, crash, container recreate) loses every pending
// timer for good and those notifications are never delivered. A durable queue
// for pending dispatches is separate work.
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

  return resolveAudienceByCohortIds(cohortIds, { excludeTeachers: true });
}

type CohortAudienceOptions = {
  /**
   * Drop every teacher-linked account from the audience. The lesson-change
   * copy is written for a student ("your lesson is cancelled"), so a teacher
   * who still carries a `cohort_id` must not receive it; teachers get the
   * `*_teacher` variants instead.
   */
  excludeTeachers?: boolean;
};

async function resolveAudienceByCohortIds(
  cohortIds: string[],
  { excludeTeachers = false }: CohortAudienceOptions = {}
): Promise<AudienceUser[]> {
  const roleFilter = excludeTeachers
    ? [not(linkedTeacherExists(userTable.id))]
    : [];

  const users = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
      name: userTable.name,
    })
    .from(userTable)
    .where(and(inArray(userTable.cohortId, cohortIds), ...roleFilter));

  return enrichUsersWithLanguage(users);
}

export async function resolveAudienceByCohortOrAll(
  cohortIds?: string[]
): Promise<AudienceUser[]> {
  let users: AudienceUserSource[];
  if (!cohortIds || cohortIds.length === 0) {
    users = await db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
        name: userTable.name,
      })
      .from(userTable);
  } else {
    users = await db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
        name: userTable.name,
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
      name: userTable.name,
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
      name: userTable.name,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!target) {
    return [];
  }

  const [prefs] = await db
    .select({
      language: userPreferences.language,
      notificationPreferences: userPreferences.notificationPreferences,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, target.id))
    .limit(1);

  return [
    {
      cohortId: target.cohortId,
      email: target.email,
      id: target.id,
      language: prefs?.language ?? 'hu',
      name: target.name,
      notificationPreferences: prefs?.notificationPreferences,
    },
  ];
}

/** The columns an audience query selects; the language is merged in after. */
export type AudienceUserSource = {
  cohortId: string | null;
  email: string;
  id: string;
  name: string;
};

/**
 * Merge each recipient's preferences row into the audience: the language for
 * the mail, and the stored (still partial) notification record the delivery
 * step gates on, so a recipient's preferences are read once and not again per
 * mail. Shared with `teacher-audience`, so the teacher-addressed mails resolve
 * a language the same way every other audience does.
 */
export async function enrichUsersWithLanguage(
  users: AudienceUserSource[]
): Promise<AudienceUser[]> {
  if (users.length === 0) {
    return [];
  }

  const prefResults = await db
    .select({
      language: userPreferences.language,
      notificationPreferences: userPreferences.notificationPreferences,
      userId: userPreferences.userId,
    })
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
      name: u.name,
      notificationPreferences: prefs?.notificationPreferences,
    };
  });
}

/**
 * Preferences and the actual write for one recipient. A user who opted out of
 * the type is a normal outcome, not an error.
 *
 * Exported so the gate and the write can be exercised against a fake database
 * and a fake queue; `fireNotification` is the only production caller.
 */
export async function deliverToUser(
  type: NotificationType,
  payload: unknown,
  handler: NotificationHandler,
  user: AudienceUser
): Promise<void> {
  // The audience already carries the recipient's stored preferences, so the
  // only thing left to resolve per recipient is whether a teacher row links
  // this user — the role-aware default for the email flag.
  const [row] = await db
    .select({ hasTeacher: linkedTeacherExists(userTable.id) })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  // A user who never opened their settings has no row, and a row written
  // before a toggle existed lacks that key; both fall back per key rather
  // than reading `undefined`, which the gate below would treat as an
  // opt-out. The helper also resolves the legacy `channelsEnabled` switch, so
  // the email flag read here is already the effective one.
  const preferences: NotificationPreferences = completePreferences(
    user.notificationPreferences,
    { email: row?.hasTeacher ?? false }
  );

  const prefKey = handler.preferenceKey;
  // `system_message` is exempt from the per-type gate: the school may always
  // reach a recipient in-app, whatever their stored flags say.
  if (!isNotificationAllowed(type, prefKey, preferences)) {
    logger.debug('User {userId} opted out of notification type {type}', {
      type,
      userId: user.id,
    });
    return;
  }

  const content: NotificationContent = handler.buildContent(
    payload,
    user.language
  );

  // Details and highlights are what the email renders below the hero; the
  // inbox has no room for a parallel schema, so they ride along in the row's
  // metadata next to the action/slug keys a handler may already set.
  const metadata = {
    ...content.metadata,
    ...(content.details?.length ? { details: content.details } : {}),
    ...(content.highlights?.length ? { highlights: content.highlights } : {}),
  };

  // The inbox row is always written. Push has no user-facing switch and is
  // attempted for every notification, so the delivery is always queued;
  // only email is gated, and the queue reads that flag.
  //
  // `system_message` mails every recipient too: the type cannot be opted out
  // of, so neither the channel switch nor a legacy unsubscribe drops it.
  // Announcement mail is opt-in and off by default: the `announcement` flag
  // above gates the notification as a whole, while this extra key is needed
  // before the mail leg runs. Every other type keeps the channel switch as its
  // only email gate.
  const emailEnabled = resolveEmailAllowed(type, preferences);

  const [notif] = await db
    .insert(notification)
    .values({
      content: content.content,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      title: content.title,
      type,
      userId: user.id,
    })
    .returning();

  enqueue({
    content: content.content,
    details: content.details,
    email: user.email,
    emailEnabled,
    highlights: content.highlights,
    language: user.language,
    notificationId: notif?.id ?? randomUUID(),
    recipientName: user.name,
    title: content.title,
    type,
    userId: user.id,
  });
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

    // One recipient's failure must not cost the rest their notification: log it
    // with the ids needed to investigate and carry on with the audience.
    let delivered = 0;
    for (const user of audience) {
      try {
        await deliverToUser(type, payload, handler, user);
        delivered += 1;
      } catch (error) {
        logger.error(
          'Failed to deliver notification type {type} to user {userId}',
          { error, type, userId: user.id }
        );
      }
    }

    logger.info(
      'Dispatched notification type {type} to {delivered} of {audience} recipients',
      {
        audience: audience.length,
        delivered,
        type,
      }
    );
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
