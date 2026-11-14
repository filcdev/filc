import { colorSchemeSchema } from '@filcdev/api/domains/theme';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { requireAuthentication } from '#middleware/auth';
import {
  buildAnnouncementContent,
  buildBlogPostContent,
  buildSystemMessageContent,
} from '#modules/news/_notifications';
import { announcement, blogPost, systemMessage } from '#modules/news/schema';
import { resolveTitle } from '#modules/news/utils/shared';
import {
  fcmToken,
  notification,
  userPreferences,
} from '#modules/notifications/schema';
import {
  buildMovedLessonNotificationContent,
  buildSubstitutionNotificationContent,
} from '#modules/timetable/_notifications';
import { loadMovedLessonNotificationPayload } from '#modules/timetable/utils/moved-lesson-notifications';
import { loadSubstitutionNotificationPayload } from '#modules/timetable/utils/substitution-notifications';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, forbidden, notFound } from '#utils/http';
import { channelDefaultsForUser } from '#utils/notifications/channel-defaults';
import { sendPush } from '#utils/notifications/providers/fcm';
import {
  renderPreviewEmail,
  sendEmail,
} from '#utils/notifications/providers/smtp';
import { enqueue } from '#utils/notifications/queue';
import { buildSubstitutionTeacherContent } from '#utils/notifications/substitution-teacher';
import {
  applyPreferencesPatch,
  type ChannelDefaults,
  completePreferences,
  type NotificationContent,
  type NotificationPreferences,
  type NotificationType,
} from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'preview']);

export const listNotifications = base.notifications.list
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const { limit, offset, type, unread, dateFrom, dateTo } = input;

    const conditions = [eq(notification.userId, userId)];

    if (type) {
      conditions.push(eq(notification.type, type));
    }
    if (unread !== undefined) {
      conditions.push(eq(notification.read, !unread));
    }
    if (dateFrom) {
      conditions.push(sql`${notification.createdAt} >= ${new Date(dateFrom)}`);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${notification.createdAt} <= ${endDate}`);
    }

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(notification)
        .where(and(...conditions))
        .orderBy(desc(notification.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(notification)
        .where(and(...conditions)),
    ]);

    return { items, total: totalResult[0]?.count ?? 0 };
  });

export const getUnreadCount = base.notifications.unreadCount
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;

    const [result] = await db
      .select({ count: count() })
      .from(notification)
      .where(
        sql`${notification.userId} = ${userId} AND ${notification.read} = false`
      );

    return { count: result?.count ?? 0 };
  });

export const markAsRead = base.notifications.markAsRead
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const { id } = input;

    const [updated] = await db
      .update(notification)
      .set({ read: true })
      .where(
        sql`${notification.id} = ${id} AND ${notification.userId} = ${userId}`
      )
      .returning();

    if (!updated) {
      throw notFound('Notification not found');
    }

    return updated;
  });

export const markAllAsRead = base.notifications.markAllAsRead
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;

    await db
      .update(notification)
      .set({ read: true })
      .where(
        sql`${notification.userId} = ${userId} AND ${notification.read} = false`
      );

    return { ok: true as const };
  });

/**
 * Complete a stored preferences record from the defaults.
 *
 * Rows written before the update path merged a partial patch can be missing
 * keys, and the response schema requires all of them — without this a user
 * whose row was written that way could never open their settings again. A
 * legacy `channelsEnabled: false` row resolves to its effective email flag
 * (off) rather than the defaults, so it reads back as what the user chose.
 */
const withCompletePreferences = <
  T extends { colorScheme: string; notificationPreferences: unknown },
>(
  row: T,
  defaults?: ChannelDefaults
) => ({
  ...row,
  /**
   * `color_scheme` is a `text` column, so the stored value is only as good as
   * the last writer: narrow it here rather than fail a whole settings read (and
   * with it the app's first paint) over one bad row.
   */
  colorScheme: colorSchemeSchema.catch('default').parse(row.colorScheme),
  notificationPreferences: completePreferences(
    row.notificationPreferences as Partial<NotificationPreferences>,
    defaults
  ),
});

export const getNotificationSettings = base.notifications.settings
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;
    const defaults = await channelDefaultsForUser(userId);

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (prefs) {
      return withCompletePreferences(prefs, defaults);
    }

    const [created] = await db
      .insert(userPreferences)
      .values({ userId })
      .returning();

    if (!created) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create user preferences',
      });
    }

    return withCompletePreferences(created, defaults);
  });

export const updateNotificationSettings = base.notifications.updateSettings
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const body = input;
    const defaults = await channelDefaultsForUser(userId);

    const values: Record<string, unknown> = {};

    if (body.colorScheme !== undefined) {
      values.colorScheme = body.colorScheme;
    }
    if (body.language !== undefined) {
      values.language = body.language;
    }
    if (body.siteThemeAcknowledged !== undefined) {
      values.siteThemeAcknowledged = body.siteThemeAcknowledged;
    }
    if (body.siteThemeEnabled !== undefined) {
      values.siteThemeEnabled = body.siteThemeEnabled;
    }
    if (body.theme !== undefined) {
      values.theme = body.theme;
    }
    if (body.timetableView !== undefined) {
      values.timetableView = body.timetableView;
    }
    if (body.timetableClassColors !== undefined) {
      values.timetableClassColors = body.timetableClassColors;
    }
    if (body.timetableGroupDisplay !== undefined) {
      values.timetableGroupDisplay = body.timetableGroupDisplay;
    }

    // A patch may name a subset of the toggles, but the column has to hold a
    // complete record: a stored object missing a key reads as `undefined`
    // downstream, and the response schema fails on read. Resolve what is
    // stored first, then apply the patch — a legacy row's
    // `channelsEnabled: false` reads as email off, so a patch naming only a
    // type flag does not silently switch email back on.
    const [existing] = await db
      .select({
        notificationPreferences: userPreferences.notificationPreferences,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (body.notificationPreferences !== undefined) {
      values.notificationPreferences = applyPreferencesPatch(
        completePreferences(
          existing?.notificationPreferences as
            | Partial<NotificationPreferences>
            | undefined,
          defaults
        ),
        body.notificationPreferences,
        defaults
      );
    }

    const [updated] = await db
      .update(userPreferences)
      .set(values)
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (updated) {
      return withCompletePreferences(updated, defaults);
    }

    const [created] = await db
      .insert(userPreferences)
      .values({ userId, ...values })
      .returning();

    if (!created) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create user preferences',
      });
    }

    return withCompletePreferences(created, defaults);
  });

export const registerFcmToken = base.notifications.fcmTokens.register
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;

    const { token: fcmTokenValue } = input;

    // Upsert on the (user_id, token) unique index so two concurrent
    // registrations of the same token cannot both insert.
    await db
      .insert(fcmToken)
      .values({
        deviceInfo: input.deviceInfo ?? null,
        token: fcmTokenValue,
        userId,
      })
      .onConflictDoUpdate({
        set: { deviceInfo: input.deviceInfo ?? null },
        target: [fcmToken.userId, fcmToken.token],
      });

    return { ok: true as const };
  });

export const testNotification = base.notifications.test
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    if (!env.enableTestNotifications) {
      throw forbidden(
        'Test notifications are disabled (set CHRONOS_ENABLE_TEST_NOTIFICATIONS=true)'
      );
    }

    const userId = context.session.userId;
    const defaults = await channelDefaultsForUser(userId);

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const preferences = completePreferences(
      prefs?.notificationPreferences,
      defaults
    );

    const [notif] = await db
      .insert(notification)
      .values({
        content:
          'This is a test notification. If you received this, everything works.',
        title: 'Test Notification',
        type: 'test',
        userId,
      })
      .returning();

    if (!notif) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create test notification',
      });
    }

    const userRecords = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    // The dev send is a real delivery: the inbox row is always written and the
    // job is always queued, with email gated by the caller's preference and
    // push attempted by the queue like any other notification.
    enqueue({
      content: notif.content,
      email: userRecords[0]?.email ?? '',
      emailEnabled: preferences.emailEnabled,
      language: prefs?.language ?? 'hu',
      notificationId: notif.id,
      title: notif.title,
      type: 'test',
      userId,
    });

    return notif;
  });

export const unregisterFcmToken = base.notifications.fcmTokens.unregister
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const { token } = input;

    await db
      .delete(fcmToken)
      .where(
        sql`${fcmToken.userId} = ${userId} AND ${fcmToken.token} = ${token}`
      );

    return { ok: true as const };
  });

type TestTarget = {
  email: string;
  id: string;
  isUser: boolean;
  language: string;
};

async function resolveTestTarget(
  email: string | undefined,
  language: 'en' | 'hu' | undefined,
  currentUserId: string
): Promise<TestTarget> {
  let target: TestTarget = {
    email: '',
    id: currentUserId,
    isUser: true,
    language: 'hu',
  };

  if (email) {
    const [byEmail] = await db
      .select({ email: userTable.email, id: userTable.id })
      .from(userTable)
      .where(sql`lower(${userTable.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (byEmail) {
      target = {
        email: byEmail.email,
        id: byEmail.id,
        isUser: true,
        language: 'hu',
      };
    } else {
      // Unmatched address: a pure SMTP delivery test. Keep the caller out of
      // it — no unsubscribe token for the caller, no caller greeting/prefs.
      target = {
        email,
        id: '',
        isUser: false,
        language: 'hu',
      };
    }
  } else {
    const [me] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, currentUserId))
      .limit(1);
    target.email = me?.email ?? '';
  }

  const [prefs] = await db
    .select({ language: userPreferences.language })
    .from(userPreferences)
    .where(eq(userPreferences.userId, target.id))
    .limit(1);
  target.language = language ?? prefs?.language ?? 'hu';
  return target;
}

export const sendTestNotification = base.notifications.sendTest
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    if (!env.enableTestNotifications) {
      throw forbidden(
        'Test notifications are disabled (set CHRONOS_ENABLE_TEST_NOTIFICATIONS=true)'
      );
    }

    const currentUserId = context.session.userId;
    const body = input;

    const target = await resolveTestTarget(
      body.email,
      body.language,
      currentUserId
    );
    const subject = body.subject ?? 'Filc test message';
    const content =
      body.content ??
      'This is a development test message. If you received this, everything works.';

    const results = { email: false, inApp: false, push: false };

    if (target.isUser && body.channels.inApp) {
      const [notif] = await db
        .insert(notification)
        .values({ content, title: subject, type: body.type, userId: target.id })
        .returning();
      results.inApp = Boolean(notif);
    }
    if (body.channels.email) {
      const email = await sendEmail(
        target.email,
        body.type,
        target.language,
        { content, title: subject },
        target.id
      );
      results.email = email.ok;
    }
    if (target.isUser && body.channels.push) {
      results.push = (await sendPush(target.id, subject, content)).ok;
    }

    return results;
  });

/**
 * Resolve the content, details and title of a real record for the preview
 * endpoint, through the same builders the live pipeline uses. A type with no
 * loadable record (or an unsupported one) is refused rather than faked.
 */
async function resolvePreviewContent(
  type: NotificationType,
  entityId: string,
  locale: string
): Promise<NotificationContent> {
  switch (type) {
    case 'substitution':
    case 'substitution_teacher': {
      const payload = await loadSubstitutionNotificationPayload(entityId);
      if (!payload) {
        throw notFound('Substitution not found');
      }

      return type === 'substitution'
        ? buildSubstitutionNotificationContent(payload, locale)
        : buildSubstitutionTeacherContent(payload, locale);
    }
    case 'moved_lesson': {
      const payload = await loadMovedLessonNotificationPayload(entityId);
      if (!payload) {
        throw notFound('Moved lesson not found');
      }

      return buildMovedLessonNotificationContent(payload, locale);
    }
    case 'announcement': {
      const [row] = await db
        .select()
        .from(announcement)
        .where(eq(announcement.id, entityId))
        .limit(1);

      if (!row) {
        throw notFound('Announcement not found');
      }

      return buildAnnouncementContent(
        { title: resolveTitle(row.title) },
        locale
      );
    }
    case 'system_message': {
      const [row] = await db
        .select()
        .from(systemMessage)
        .where(eq(systemMessage.id, entityId))
        .limit(1);

      if (!row) {
        throw notFound('System message not found');
      }

      return buildSystemMessageContent({ title: row.title }, locale);
    }
    case 'blog_post': {
      const [row] = await db
        .select()
        .from(blogPost)
        .where(eq(blogPost.id, entityId))
        .limit(1);

      if (!row) {
        throw notFound('Blog post not found');
      }

      return buildBlogPostContent({ slug: row.slug, title: row.title }, locale);
    }
    default:
      throw badRequest('No records to preview for this notification type');
  }
}

export const previewTestNotification = base.notifications.previewTest
  .use(requireAuthentication)
  .handler(async ({ input }) => {
    if (!env.enableTestNotifications) {
      throw forbidden(
        'Test notifications are disabled (set CHRONOS_ENABLE_TEST_NOTIFICATIONS=true)'
      );
    }

    const locale = input.language ?? 'hu';

    if (input.entityId) {
      logger.debug('Rendering preview of {type} record {entityId}', {
        entityId: input.entityId,
        type: input.type,
      });
      const rendered = await resolvePreviewContent(
        input.type,
        input.entityId,
        locale
      );
      const html = await renderPreviewEmail(input.type, locale, rendered);
      return { html };
    }

    const body = input;
    const subject = body.subject ?? 'Filc test message';
    const content =
      body.content ??
      'This is a development test message. If you received this, everything works.';

    const html = await renderPreviewEmail(body.type, body.language ?? 'hu', {
      content,
      title: subject,
    });

    return { html };
  });
