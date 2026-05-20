import { zValidator } from '@hono/zod-validator';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import {
  fcmToken,
  notification,
  userPreferences,
} from '#database/schema/notifications';
import { requireAuthentication } from '#middleware/auth';
import { notificationsFactory } from '#routes/notifications/_factory';
import { env } from '#utils/environment';
import { generateUnsubscribeToken } from '#utils/notifications/providers/smtp';
import { enqueue } from '#utils/notifications/queue';

const paginationSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.string().optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const updateSettingsSchema = z.object({
  language: z.string().optional(),
  notificationPreferences: z.record(z.string(), z.unknown()).optional(),
  theme: z.string().optional(),
  timetableView: z.string().optional(),
});

const fcmTokenSchema = z.object({
  deviceInfo: z.string().optional(),
  token: z.string(),
});

const getUser = (c: { var: { user: { id: string } | null } }) => {
  const user = c.var.user;
  if (!user) {
    throw new HTTPException(StatusCodes.UNAUTHORIZED);
  }
  return user;
};

export const listNotifications = notificationsFactory.createHandlers(
  requireAuthentication,
  zValidator('query', paginationSchema),
  async (c) => {
    const { id: userId } = getUser(c);
    const { limit, offset, type, unread, dateFrom, dateTo } =
      c.req.valid('query');

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

    return c.json<SuccessResponse<typeof items> & { total: number }>({
      data: items,
      success: true,
      total: totalResult[0]?.count ?? 0,
    });
  }
);

export const getUnreadCount = notificationsFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const { id: userId } = getUser(c);

    const [result] = await db
      .select({ count: count() })
      .from(notification)
      .where(
        sql`${notification.userId} = ${userId} AND ${notification.read} = false`
      );

    return c.json<SuccessResponse<{ count: number }>>({
      data: { count: result?.count ?? 0 },
      success: true,
    });
  }
);

export const markAsRead = notificationsFactory.createHandlers(
  requireAuthentication,
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id: userId } = getUser(c);
    const { id } = c.req.valid('param');

    const [updated] = await db
      .update(notification)
      .set({ read: true })
      .where(
        sql`${notification.id} = ${id} AND ${notification.userId} = ${userId}`
      )
      .returning();

    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Notification not found',
      });
    }

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

export const markAllAsRead = notificationsFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const { id: userId } = getUser(c);

    await db
      .update(notification)
      .set({ read: true })
      .where(
        sql`${notification.userId} = ${userId} AND ${notification.read} = false`
      );

    return c.json<SuccessResponse>({
      success: true,
    });
  }
);

export const getNotificationSettings = notificationsFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const { id: userId } = getUser(c);

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (prefs) {
      return c.json<SuccessResponse<typeof prefs>>({
        data: prefs,
        success: true,
      });
    }

    const [created] = await db
      .insert(userPreferences)
      .values({ userId })
      .returning();

    return c.json<SuccessResponse<typeof created>>({
      data: created,
      success: true,
    });
  }
);

export const updateNotificationSettings = notificationsFactory.createHandlers(
  requireAuthentication,
  zValidator('json', updateSettingsSchema),
  async (c) => {
    const { id: userId } = getUser(c);
    const body = c.req.valid('json');

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

    const [updated] = await db
      .update(userPreferences)
      .set(values)
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (updated) {
      return c.json<SuccessResponse<typeof updated>>({
        data: updated,
        success: true,
      });
    }

    const [created] = await db
      .insert(userPreferences)
      .values({ userId, ...values })
      .returning();

    return c.json<SuccessResponse<typeof created>>({
      data: created,
      success: true,
    });
  }
);

export const registerFcmToken = notificationsFactory.createHandlers(
  requireAuthentication,
  zValidator('json', fcmTokenSchema),
  async (c) => {
    const { id: userId } = getUser(c);

    const { token: fcmTokenValue } = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(fcmToken)
      .where(
        and(eq(fcmToken.userId, userId), eq(fcmToken.token, fcmTokenValue))
      );

    if (!existing) {
      await db.insert(fcmToken).values({
        deviceInfo: c.req.valid('json').deviceInfo ?? null,
        token: fcmTokenValue,
        userId,
      });
    }

    return c.json<SuccessResponse>({ success: true }, StatusCodes.CREATED);
  }
);

export const testNotification = notificationsFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    if (env.mode !== 'development') {
      throw new HTTPException(StatusCodes.FORBIDDEN, {
        message: 'Test notifications can only be sent in development mode',
      });
    }

    const { id: userId } = getUser(c);

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
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
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

    return c.json<SuccessResponse<typeof notif>>({
      data: notif,
      success: true,
    });
  }
);

const tokenDeleteSchema = z.object({
  token: z.string(),
});

export const unregisterFcmToken = notificationsFactory.createHandlers(
  requireAuthentication,
  zValidator('json', tokenDeleteSchema),
  async (c) => {
    const { id: userId } = getUser(c);
    const { token } = c.req.valid('json');

    await db
      .delete(fcmToken)
      .where(
        sql`${fcmToken.userId} = ${userId} AND ${fcmToken.token} = ${token}`
      );

    return c.json<SuccessResponse>({ success: true });
  }
);

export const getUnsubscribePage = notificationsFactory.createHandlers(
  zValidator(
    'query',
    z.object({ token: z.string(), userId: z.string().uuid() })
  ),
  (c) => {
    const { token, userId } = c.req.valid('query');

    return c.html(`<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leiratkozás - Filc</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 24px; }
    p { color: #666; margin: 0 0 24px; }
    button { background: #d93025; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; }
    button:hover { background: #c62828; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Leiratkozás az értesítésekről</h1>
    <p>Szeretnéd lemondani az összes email értesítést a Filc rendszertől? Ezután nem fogsz több emailt kapni.</p>
    <form method="POST" action="/api/notifications/unsubscribe">
      <input type="hidden" name="userId" value="${userId}">
      <input type="hidden" name="token" value="${token}">
      <button type="submit">Leiratkozás</button>
    </form>
  </div>
</body>
</html>`);
  }
);

export const processUnsubscribe = notificationsFactory.createHandlers(
  zValidator(
    'form',
    z.object({ token: z.string(), userId: z.string().uuid() })
  ),
  async (c) => {
    const { token, userId } = c.req.valid('form');

    const expected = generateUnsubscribeToken(userId);
    if (expected !== token) {
      return c.html(
        `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="utf-8"><title>Hiba - Filc</title></head>
<body><h1>Érvénytelen leiratkozási token</h1><p>A token érvénytelen vagy lejárt.</p></body>
</html>`,
        StatusCodes.BAD_REQUEST
      );
    }

    const allDisabled = {
      announcement: false,
      blogPost: false,
      channelsEnabled: false,
      doorlockCardUsed: false,
      movedLesson: false,
      substitution: false,
      systemMessage: false,
    };

    await db
      .insert(userPreferences)
      .values({ notificationPreferences: allDisabled, userId })
      .onConflictDoUpdate({
        set: { notificationPreferences: allDisabled },
        target: userPreferences.userId,
      });

    return c.html(`<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sikeres leiratkozás - Filc</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 24px; color: #2e7d32; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sikeres leiratkozás</h1>
    <p>Innentől nem fogsz email értesítéseket kapni a Filc rendszertől.</p>
  </div>
</body>
</html>`);
  }
);
