import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication } from '#middleware/auth';
import { requireWifiEnabled } from '#middleware/wifi';
import { base } from '#orpc';
import { env } from '#utils/environment';
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from '#utils/http';
import { wifiDevice, wifiUser } from './schema';
import { encryptPassword } from './utils/encryptor';
import { resolveEffectiveSpeedProfileDetails } from './utils/speed-profile';

const logger = getLogger(['chronos', 'wifi', 'self']);

/**
 * Find the account of a signed-in user: the linked row, or an unclaimed legacy
 * row whose username is exactly their (case-insensitive) email address. A
 * found unclaimed row is linked before it is returned.
 *
 * Only a full-email match qualifies. Matching the email's local part would let
 * any user whose local part collides with an unclaimed wifi username take over
 * that account, password included.
 */
const findAccount = async (userId: string, email?: string | null) => {
  const [linked] = await db
    .select()
    .from(wifiUser)
    .where(eq(wifiUser.userId, userId))
    .limit(1);
  if (linked || !email) {
    return linked;
  }

  const [unclaimed] = await db
    .select()
    .from(wifiUser)
    .where(
      and(
        sql`lower(${wifiUser.username}) = lower(${email})`,
        isNull(wifiUser.userId)
      )
    )
    .limit(1);
  if (!unclaimed) {
    return undefined;
  }

  const [updated] = await db
    .update(wifiUser)
    .set({ userId })
    .where(eq(wifiUser.id, unclaimed.id))
    .returning();
  return updated;
};

const findCertFile = (targetPath: string): string | null => {
  if (!existsSync(targetPath)) {
    return null;
  }
  try {
    const stat = statSync(targetPath);
    if (stat.isFile()) {
      return targetPath;
    }
    if (stat.isDirectory()) {
      const caPem = path.join(targetPath, 'ca.pem');
      if (existsSync(caPem)) {
        return caPem;
      }
      const caCrt = path.join(targetPath, 'ca.crt');
      if (existsSync(caCrt)) {
        return caCrt;
      }
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Resolve the configured CA path. A relative path is resolved against the
 * current working directory (which differs between `bun dev` at the repo root
 * and at `apps/chronos`) and against the Chronos package root.
 */
export const resolveWifiCaCertPath = (
  configuredPath?: string
): string | null => {
  if (!configuredPath) {
    return null;
  }

  const normalized = configuredPath.trim();
  if (!normalized) {
    return null;
  }

  const candidates = path.isAbsolute(normalized)
    ? [normalized]
    : [
        path.resolve(process.cwd(), normalized),
        path.resolve(import.meta.dir, '../../..', normalized),
      ];

  for (const candidate of candidates) {
    const certFile = findCertFile(candidate);
    if (certFile) {
      return certFile;
    }
  }

  return null;
};

export const createSelfWifi = base.wifi.self.create
  .use(requireWifiEnabled)
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const userEmail = context.user?.email ?? null;
    const userId = context.session.userId;
    if (!userEmail) {
      throw badRequest('User email is required');
    }

    if (await findAccount(userId, userEmail)) {
      throw conflict('WiFi account already exists');
    }

    if (!env.wifiEncryptionSecret) {
      throw serviceUnavailable('WiFi encryption is not configured');
    }

    const encrypted = await encryptPassword(
      input.password,
      userEmail,
      env.wifiEncryptionSecret
    );

    const [account] = await db
      .insert(wifiUser)
      .values({
        banned: false,
        createdBy: userId,
        encryptedPassword: encrypted.encryptedPassword,
        salt: encrypted.salt,
        userId,
        username: userEmail,
      })
      .returning();

    if (!account) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create WiFi account',
        status: 500,
      });
    }

    const speedLimit = await resolveEffectiveSpeedProfileDetails(account);
    const devices = await db
      .select()
      .from(wifiDevice)
      .where(eq(wifiDevice.wifiUserId, account.id));

    return {
      wifi: {
        banned: account.banned,
        devices,
        speedLimit,
        username: account.username,
      },
    };
  });

export const getSelfWifi = base.wifi.self.get
  .use(requireWifiEnabled)
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const account = await findAccount(
      context.session.userId,
      context.user?.email
    );
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const devices = await db
      .select()
      .from(wifiDevice)
      .where(eq(wifiDevice.wifiUserId, account.id));
    const speed = await resolveEffectiveSpeedProfileDetails(account);

    return {
      wifi: {
        banned: account.banned,
        devices,
        speedLimit: {
          downloadSpeedMbps: speed.downloadSpeedMbps,
          roleName: speed.roleName,
          source: speed.source,
          speedProfileId: speed.speedProfileId,
          uploadSpeedMbps: speed.uploadSpeedMbps,
        },
        username: account.username,
      },
    };
  });

export const updateSelfWifiDevice = base.wifi.self.updateDevice
  .use(requireWifiEnabled)
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const account = await findAccount(
      context.session.userId,
      context.user?.email
    );
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const [device] = await db
      .update(wifiDevice)
      .set({ nickname: input.nickname, updatedAt: new Date() })
      .where(
        and(eq(wifiDevice.id, input.id), eq(wifiDevice.wifiUserId, account.id))
      )
      .returning();
    if (!device) {
      throw notFound('WiFi device not found');
    }

    return { device };
  });

export const updateSelfWifiPassword = base.wifi.self.changePassword
  .use(requireWifiEnabled)
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const account = await findAccount(
      context.session.userId,
      context.user?.email
    );
    if (!account) {
      throw notFound('WiFi account not found');
    }

    if (!env.wifiEncryptionSecret) {
      throw serviceUnavailable('WiFi encryption is not configured');
    }

    const encrypted = await encryptPassword(
      input.newPassword,
      account.username,
      env.wifiEncryptionSecret
    );
    await db
      .update(wifiUser)
      .set({
        encryptedPassword: encrypted.encryptedPassword,
        salt: encrypted.salt,
        updatedAt: new Date(),
      })
      .where(eq(wifiUser.id, account.id));

    return { success: true };
  });

export const getSelfWifiCertificate = base.wifi.self.certificate
  .use(requireWifiEnabled)
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const account = await findAccount(
      context.session.userId,
      context.user?.email
    );
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const certPath = env.wifiCaCertPath;
    if (!certPath) {
      throw serviceUnavailable('WiFi CA certificate is not configured');
    }

    const resolved = resolveWifiCaCertPath(certPath);
    if (!resolved) {
      logger.error('WiFi CA certificate file not found: {certPath}', {
        certPath,
      });
      throw new ORPCError('INTERNAL', {
        message: 'Failed to read CA certificate file',
        status: 500,
      });
    }

    let pem: string;
    try {
      pem = await Bun.file(resolved).text();
    } catch (error) {
      logger.error('Failed to read CA certificate file: {error}', {
        error: String(error),
      });
      throw new ORPCError('INTERNAL', {
        message: 'Failed to read CA certificate file',
        status: 500,
      });
    }

    context.resHeaders?.set(
      'Content-Disposition',
      'attachment; filename="wifi-ca.pem"'
    );
    return new File([pem], 'wifi-ca.pem', {
      type: 'application/x-pem-file',
    });
  });
