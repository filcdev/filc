import { ORPCError } from '@orpc/server';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { requireAuthentication } from '#middleware/auth';
import {
  fcmToken,
  notification,
  userPreferences,
} from '#modules/notifications/schema';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { forbidden, notFound } from '#utils/http';
import { sendPush } from '#utils/notifications/providers/fcm';
import { renderEmail, sendEmail } from '#utils/notifications/providers/smtp';
import { enqueue } from '#utils/notifications/queue';

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

export const getNotificationSettings = base.notifications.settings
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (prefs) {
      return prefs;
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

    return created;
  });

export const updateNotificationSettings = base.notifications.updateSettings
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const body = input;

    const values: Record<string, unknown> = {};

    if (body.language !== undefined) {
      values.language = body.language;
    }
    if (body.theme !== undefined) {
      values.theme = body.theme;
    }
    if (body.timetableView !== undefined) {
      values.timetableView = body.timetableView;
    }
    if (body.notificationPreferences !== undefined) {
      values.notificationPreferences = body.notificationPreferences;
    }
    if (body.timetableClassColors !== undefined) {
      values.timetableClassColors = body.timetableClassColors;
    }
    if (body.timetableGroupDisplay !== undefined) {
      values.timetableGroupDisplay = body.timetableGroupDisplay;
    }

    const [updated] = await db
      .update(userPreferences)
      .set(values)
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (updated) {
      return updated;
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

    return created;
  });

export const registerFcmToken = base.notifications.fcmTokens.register
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;

    const { token: fcmTokenValue } = input;

    const [existing] = await db
      .select()
      .from(fcmToken)
      .where(
        and(eq(fcmToken.userId, userId), eq(fcmToken.token, fcmTokenValue))
      );

    if (!existing) {
      await db.insert(fcmToken).values({
        deviceInfo: input.deviceInfo ?? null,
        token: fcmTokenValue,
        userId,
      });
    }

    return { ok: true as const };
  });

export const testNotification = base.notifications.test
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    if (env.mode !== 'development') {
      throw forbidden(
        'Test notifications can only be sent in development mode'
      );
    }

    const userId = context.session.userId;

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

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const userRecords = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    enqueue({
      channelsEnabled: prefs?.notificationPreferences?.channelsEnabled ?? true,
      content: notif.content,
      email: userRecords[0]?.email ?? '',
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
    if (env.mode !== 'development') {
      throw forbidden(
        'Test notifications can only be sent in development mode'
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
      results.email = await sendEmail(
        target.email,
        subject,
        body.type,
        target.language,
        { content, title: subject },
        target.id
      );
    }
    if (target.isUser && body.channels.push) {
      results.push = await sendPush(target.id, subject, content);
    }

    return results;
  });

export const previewTestNotification = base.notifications.previewTest
  .use(requireAuthentication)
  .handler(async ({ input }) => {
    if (env.mode !== 'development') {
      throw forbidden(
        'Test notifications can only be previewed in development mode'
      );
    }

    const body = input;
    const subject = body.subject ?? 'Filc test message';
    const content =
      body.content ??
      'This is a development test message. If you received this, everything works.';

    const html = await renderEmail(body.type, body.language ?? 'hu', {
      content,
      title: subject,
    });

    return { html };
  });
