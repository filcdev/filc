import { colorSchemeSchema } from '@filcdev/api/domains/theme';
import { createTranslator } from '@filcdev/i18n';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
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
  buildMovedLessonTeacherContent,
  buildSubstitutionNotificationContent,
} from '#modules/timetable/_notifications';
import { loadMovedLessonNotificationPayload } from '#modules/timetable/utils/moved-lesson-notifications';
import { loadSubstitutionNotificationPayload } from '#modules/timetable/utils/substitution-notifications';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, forbidden, notFound } from '#utils/http';
import { channelDefaultsForUser } from '#utils/notifications/channel-defaults';
import { mailLocale } from '#utils/notifications/locale';
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
import { cutoffLiteral, startOfDayInTimeZone } from '#utils/time-zone';

const logger = getLogger(['chronos', 'notifications', 'preview']);

/** The column stores UTC, so the cutoff is pinned as an explicit UTC literal. */
export const createdBeforeToday = () =>
  sql<boolean>`${notification.createdAt} < ${cutoffLiteral(new Date(), env.timeZone)}::timestamp`;

/** What the inbox list filters on, once the contract has parsed the query. */
type NotificationListFilter = {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  unread?: boolean;
  userId: string;
};

/**
 * The WHERE chain of the inbox list, shared by the page and its count.
 *
 * Exported with `createdBeforeToday` so the predicate can be rendered in a
 * test: the unread clause has to stay parenthesised, because `or` binds looser
 * than the `and` carrying the user scoping and an unparenthesised
 * `read OR beforeToday` would escape it.
 */
export function notificationListConditions(input: NotificationListFilter) {
  const { dateFrom, dateTo, type, unread, userId } = input;

  // Unread means "today": a row from a past day counts as read, both in the
  // unread filter and in the computed column every row comes back with. One
  // cutoff per request keeps the two expressions on the same day.
  const beforeToday = createdBeforeToday();

  const conditions = [eq(notification.userId, userId)];

  if (type) {
    conditions.push(eq(notification.type, type));
  }
  if (unread !== undefined) {
    // Kept parenthesised: these conditions are joined with `and`, which binds
    // tighter than `or`, so an unparenthesised `read OR beforeToday` would
    // escape the user scoping above.
    const readFilter = unread
      ? and(eq(notification.read, false), not(beforeToday))
      : or(notification.read, beforeToday);
    conditions.push(sql<boolean>`(${readFilter})`);
  }
  if (dateFrom) {
    // Same school-timezone day boundary as the unread cutoff above, so the
    // range filter and "unread means today" agree on where a day starts.
    conditions.push(
      sql`${notification.createdAt} >= ${startOfDayInTimeZone(new Date(dateFrom), env.timeZone)}`
    );
  }
  if (dateTo) {
    // Inclusive end of the chosen day: everything before the next day starts
    // in the school timezone. Midday + one day keeps a DST shift from moving
    // the calendar day the helper then resolves.
    const noon =
      startOfDayInTimeZone(new Date(dateTo), env.timeZone).getTime() +
      12 * 60 * 60 * 1000;
    const exclusiveEnd = startOfDayInTimeZone(
      new Date(noon + 24 * 60 * 60 * 1000),
      env.timeZone
    );
    conditions.push(sql`${notification.createdAt} < ${exclusiveEnd}`);
  }

  return { beforeToday, conditions };
}

/**
 * The derived `read` column: the row's own flag, or any row from a past day,
 * which counts as read for display. Parenthesised because it is one item of a
 * select list.
 */
export function notificationReadColumn(beforeToday: SQL<boolean>) {
  return sql<boolean>`(${or(notification.read, beforeToday)})`;
}

export const listNotifications = base.notifications.list
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { limit, offset } = input;
    const { beforeToday, conditions } = notificationListConditions({
      ...input,
      userId: context.session.userId,
    });

    const [items, totalResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(notification),
          // Computed, not stored: the row's own `read` flag only turns a
          // past-day notification into a read one for display.
          read: notificationReadColumn(beforeToday),
        })
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
        and(
          eq(notification.userId, userId),
          // Same "unread means today" rule as `listNotifications`.
          eq(notification.read, false),
          not(createdBeforeToday())
        )
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

/**
 * The three test endpoints are development tools: each refuses to run unless the
 * server was started with `CHRONOS_ENABLE_TEST_NOTIFICATIONS=true`, so a
 * deployment cannot be talked into sending mail or push to arbitrary addresses.
 */
function requireTestNotificationsEnabled(): void {
  if (!env.enableTestNotifications) {
    throw forbidden(
      'Test notifications are disabled (set CHRONOS_ENABLE_TEST_NOTIFICATIONS=true)'
    );
  }
}

export const testNotification = base.notifications.test
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    requireTestNotificationsEnabled();

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
    const lang = mailLocale(prefs?.language);
    const t = createTranslator(lang);

    const [notif] = await db
      .insert(notification)
      .values({
        content: t('test.notificationBody'),
        title: t('test.notificationTitle'),
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
      .select({ email: userTable.email, name: userTable.name })
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
      language: lang,
      notificationId: notif.id,
      recipientName: userRecords[0]?.name ?? '',
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
  name?: string;
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
      .select({
        email: userTable.email,
        id: userTable.id,
        name: userTable.name,
      })
      .from(userTable)
      .where(sql`lower(${userTable.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (byEmail) {
      target = {
        email: byEmail.email,
        id: byEmail.id,
        isUser: true,
        language: 'hu',
        name: byEmail.name,
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
      .select({ email: userTable.email, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, currentUserId))
      .limit(1);
    target.email = me?.email ?? '';
    target.name = me?.name;
  }

  // A non-user target has no row to read (and no uuid to read it with), so the
  // requested language — or the column default — is the answer.
  if (target.isUser) {
    const [prefs] = await db
      .select({ language: userPreferences.language })
      .from(userPreferences)
      .where(eq(userPreferences.userId, target.id))
      .limit(1);
    target.language = language ?? prefs?.language ?? 'hu';
  } else {
    target.language = language ?? 'hu';
  }
  return target;
}

export const sendTestNotification = base.notifications.sendTest
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    requireTestNotificationsEnabled();

    const currentUserId = context.session.userId;
    const body = input;

    const target = await resolveTestTarget(
      body.email,
      body.language,
      currentUserId
    );
    const lang = mailLocale(target.language);
    const t = createTranslator(lang);
    const subject = body.subject ?? t('test.messageSubject');
    const content = body.content ?? t('test.messageBody');

    const results = { email: false, inApp: false, push: false };
    const metadata = {
      ...(body.details?.length ? { details: body.details } : {}),
      ...(body.highlights?.length ? { highlights: body.highlights } : {}),
    };

    if (target.isUser && body.channels.inApp) {
      const [notif] = await db
        .insert(notification)
        .values({
          content,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          title: subject,
          type: body.type,
          userId: target.id,
        })
        .returning();
      results.inApp = Boolean(notif);
    }
    if (body.channels.email) {
      const email = await sendEmail(
        target.email,
        body.type,
        target.language,
        {
          content,
          details: body.details,
          highlights: body.highlights,
          title: subject,
        },
        target.id,
        target.name
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
    case 'moved_lesson':
    case 'moved_lesson_teacher': {
      const payload = await loadMovedLessonNotificationPayload(entityId);
      if (!payload) {
        throw notFound('Moved lesson not found');
      }

      return type === 'moved_lesson'
        ? buildMovedLessonNotificationContent(payload, locale)
        : buildMovedLessonTeacherContent(payload, locale);
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
    requireTestNotificationsEnabled();

    const locale = mailLocale(input.language);

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
    const t = createTranslator(locale);
    const subject = body.subject ?? t('test.messageSubject');
    const content = body.content ?? t('test.messageBody');

    const html = await renderPreviewEmail(body.type, locale, {
      content,
      details: body.details,
      highlights: body.highlights,
      title: subject,
    });

    return { html };
  });
