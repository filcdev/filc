import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import type {
  Messaging as FirebaseMessaging,
  MulticastMessage,
} from 'firebase-admin/messaging';
import { db } from '#database';
import { fcmToken } from '#modules/notifications/schema';
import { env } from '#utils/environment';
import { interpretFcmBatch } from '#utils/notifications/fcm-outcome';
import type { ChannelAttemptResult } from '../queue-outcome';

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
export async function sendPush(
  userId: string,
  title: string,
  body: string
): Promise<ChannelAttemptResult> {
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

    const outcome = interpretFcmBatch(tokenValues, response.responses);

    // The distinct codes, not one line per device: the batch can be large and
    // the code is what says whether a retry could help.
    const errorCodes = [
      ...new Set(
        response.responses
          .filter((resp) => !resp.success)
          .map((resp) => resp.error?.code ?? 'unknown')
      ),
    ];

    if (outcome.deliveredCount === 0 && outcome.skipped === true) {
      // Nothing was delivered and retrying cannot help: usually every device
      // rejected a dead token, which the cleanup below deletes. Routine, so
      // `info`, but the codes stay on the line to tell that apart from an
      // empty batch.
      logger.info(
        'FCM push for user {userId}: nothing delivered, {failed} failed ({errorCodes})',
        {
          errorCodes,
          failed: outcome.failedCount,
          userId,
        }
      );
    } else if (outcome.deliveredCount === 0 || outcome.failedCount > 0) {
      // Either nothing landed and a retry may help, or some devices missed the
      // push while others got it. Both are worth a warning; a fully delivered
      // batch is not logged here at all.
      logger.warning(
        'FCM push for user {userId}: {delivered} delivered, {failed} failed ({errorCodes})',
        {
          delivered: outcome.deliveredCount,
          errorCodes,
          failed: outcome.failedCount,
          userId,
        }
      );
    }

    if (outcome.invalidTokens.length > 0) {
      const count = outcome.invalidTokens.length;
      try {
        await db
          .delete(fcmToken)
          .where(inArray(fcmToken.token, outcome.invalidTokens));
        logger.info('Cleaned up {count} invalid FCM tokens', { count, userId });
      } catch (error) {
        // The push already reached its verdict for these devices; a failed
        // cleanup must not turn a delivered push into a retry.
        logger.error(
          'Failed to delete {count} invalid FCM tokens for user {userId}',
          { count, error, userId }
        );
      }
    }

    logger.debug('FCM multicast sent to {count} tokens for user {userId}', {
      count: tokenValues.length,
      userId,
    });
    return { ok: outcome.ok, skipped: outcome.skipped };
  } catch (error) {
    logger.error('Failed to send FCM push to user {userId}', { error, userId });
    return { ok: false };
  }
}
