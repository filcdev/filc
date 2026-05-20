import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import type { messaging as FirebaseMessaging } from 'firebase-admin';
import { db } from '#database';
import { fcmToken } from '#database/schema/notifications';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'notifications', 'fcm']);

let fcmMessaging: FirebaseMessaging.Messaging | null = null;

export function initializeFcm(): boolean {
  if (!env.fcmCredentials) {
    logger.warn('FCM credentials not configured, push notifications disabled');
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    const credentials = JSON.parse(env.fcmCredentials);

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: env.fcmProjectId,
      });
    }

    fcmMessaging = admin.messaging();
    logger.info('FCM initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize FCM', { error });
    return false;
  }
}

export async function sendPush(
  userId: string,
  title: string,
  body: string
): Promise<boolean> {
  if (!fcmMessaging) {
    logger.debug('FCM not available, skipping push for user {userId}', {
      userId,
    });
    return false;
  }

  try {
    const tokens = await db
      .select({ token: fcmToken.token })
      .from(fcmToken)
      .where(eq(fcmToken.userId, userId));

    const tokenValues = tokens.map((t) => t.token);

    if (tokenValues.length === 0) {
      logger.debug('No FCM tokens for user {userId}', { userId });
      return false;
    }

    const message: FirebaseMessaging.MulticastMessage = {
      data: {
        type: 'notification',
      },
      notification: {
        body,
        title,
      },
      tokens: tokenValues,
    };

    const response = await fcmMessaging.sendEachForMulticast(message);

    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        logger.debug('FCM send failed for token index {idx}', {
          error: resp.error,
          idx,
        });
      }
      if (
        resp.error?.code === 'messaging/invalid-registration-token' ||
        resp.error?.code === 'messaging/registration-token-not-registered'
      ) {
        const token = tokenValues[idx];
        if (token) {
          invalidTokens.push(token);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await db.delete(fcmToken).where(inArray(fcmToken.token, invalidTokens));
      logger.info('Cleaned up {count} invalid FCM tokens', {
        count: invalidTokens.length,
      });
    }

    logger.debug('FCM multicast sent to {count} tokens for user {userId}', {
      count: tokenValues.length,
      userId,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send FCM push to user {userId}', { error, userId });
    return false;
  }
}
