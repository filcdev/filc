import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import type {
  Messaging as FirebaseMessaging,
  MulticastMessage,
} from 'firebase-admin/messaging';
import { db } from '#database';
import { fcmToken } from '#modules/notifications/schema';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'notifications', 'fcm']);

let fcmMessaging: FirebaseMessaging | null = null;
/**
 * Set when `initializeFcm` threw: credentials exist but the app could not be
 * built. That is an infrastructure failure, not "no device to send to", so
 * `sendPush` must let the queue retry instead of reporting the delivery as
 * satisfied.
 */
let fcmInitFailed = false;

export async function initializeFcm(): Promise<boolean> {
  if (!env.fcmCredentials) {
    logger.warn('FCM credentials not configured, push notifications disabled');
    return false;
  }

  try {
    // Imported dynamically so firebase-admin is only loaded when FCM
    // credentials are configured (a static import would pull it in always).
    const { cert, getApps, initializeApp } = await import('firebase-admin');
    const { getMessaging } = await import('firebase-admin/messaging');
    const credentials = JSON.parse(env.fcmCredentials);

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(credentials),
        projectId: env.fcmProjectId,
      });
    }

    fcmMessaging = getMessaging();
    fcmInitFailed = false;
    logger.info('FCM initialized successfully');
    return true;
  } catch (error) {
    fcmInitFailed = true;
    logger.error(
      'Failed to initialize FCM; push delivery will fail and be retried',
      { error }
    );
    return false;
  }
}

/**
 * Outcome of one push attempt. `skipped` distinguishes "there was nothing to
 * send to" (no registered device, FCM not configured) from a real delivery
 * failure, so the queue can treat a skip as satisfied instead of retrying. A
 * broken FCM initialization is *not* skipped: it is retryable and dead-letters.
 */
export type PushResult = {
  ok: boolean;
  skipped?: boolean;
};

export async function sendPush(
  userId: string,
  title: string,
  body: string
): Promise<PushResult> {
  if (fcmInitFailed) {
    logger.error(
      'FCM initialization failed earlier, push for user {userId} is a failed delivery',
      { userId }
    );
    return { ok: false };
  }

  if (!fcmMessaging) {
    logger.debug('FCM not configured, skipping push for user {userId}', {
      userId,
    });
    return { ok: false, skipped: true };
  }

  try {
    const tokens = await db
      .select({ token: fcmToken.token })
      .from(fcmToken)
      .where(eq(fcmToken.userId, userId));

    const tokenValues = tokens.map((t) => t.token);

    if (tokenValues.length === 0) {
      logger.debug('No FCM tokens for user {userId}', { userId });
      return { ok: false, skipped: true };
    }

    const message: MulticastMessage = {
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
    return { ok: true };
  } catch (error) {
    logger.error('Failed to send FCM push to user {userId}', { error, userId });
    return { ok: false };
  }
}
