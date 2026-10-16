import { Database } from 'bun:sqlite';
import process from 'node:process';
import { getLogger } from '@logtape/logtape';
import type { db as database } from '../src/database';
import { db } from '../src/database';
import { user as systemUser } from '../src/database/schema/authentication';
import { wifiDevice, wifiNas, wifiUser } from '../src/modules/wifi/schema';
import { canonicalizeMac } from '../src/modules/wifi/utils/mac';
import { configureLogger } from '../src/utils/logger';

await configureLogger('chronos');

const logger = getLogger(['chronos', 'migrate-petrikwifi']);

type LegacyUser = {
  allowedDevices: string | null;
  banned: number | null;
  comment: string | null;
  password: string;
  salt: string;
  userID: number;
  username: string;
};

type LegacyDevice = {
  banned: number | null;
  comment: string | null;
  device: string;
  lastActive: string | null;
  userID: number | null;
};

type LegacyAp = {
  AP: string;
  IP: string;
  comment: string | null;
};

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

type UserLookups = {
  /** Chronos user id by their full email address. */
  emailToId: Map<string, string>;
  /** Chronos user id by their email's local part, for legacy rows that used it. */
  usernameToId: Map<string, string>;
};

const readLegacy = (sqlite: Database) => ({
  aps: sqlite.query('SELECT * FROM APs').all() as LegacyAp[],
  devices: sqlite.query('SELECT * FROM Devices').all() as LegacyDevice[],
  users: sqlite.query('SELECT * FROM Users').all() as LegacyUser[],
});

const buildLookups = async (): Promise<UserLookups> => {
  const existingUsers = await db
    .select({ email: systemUser.email, id: systemUser.id })
    .from(systemUser);

  return {
    emailToId: new Map(
      existingUsers.map((user) => [user.email.toLowerCase(), user.id])
    ),
    usernameToId: new Map(
      existingUsers.map((user) => [
        (user.email.split('@')[0] || '').toLowerCase(),
        user.id,
      ])
    ),
  };
};

/** Insert the legacy accounts; returns legacy id → new wifi account id. */
const importUsers = async (
  tx: Transaction,
  users: LegacyUser[],
  lookups: UserLookups
): Promise<Map<number, string>> => {
  const userIdMap = new Map<number, string>();

  for (const user of users) {
    const wifiUsername = (user.username || '').toLowerCase();
    const userId =
      lookups.emailToId.get(wifiUsername) ??
      lookups.usernameToId.get(wifiUsername) ??
      null;

    const [inserted] = await tx
      .insert(wifiUser)
      .values({
        allowedMacAddresses: user.allowedDevices
          ? (JSON.parse(user.allowedDevices) as string[])
          : [],
        banned: Boolean(user.banned),
        comment: user.comment,
        createdBy: userId,
        encryptedPassword: user.password,
        salt: user.salt,
        userId,
        username: user.username,
      })
      .returning({ id: wifiUser.id });

    if (inserted) {
      userIdMap.set(user.userID, inserted.id);
    }
  }

  return userIdMap;
};

const importDevices = async (
  tx: Transaction,
  devices: LegacyDevice[],
  userIdMap: Map<number, string>
): Promise<void> => {
  for (const device of devices) {
    const wifiUserId = userIdMap.get(device.userID ?? -1);
    // Unassigned devices are only worth carrying over when they are bans.
    if (!(wifiUserId || device.banned)) {
      continue;
    }

    await tx
      .insert(wifiDevice)
      .values({
        banned: Boolean(device.banned),
        lastActiveAt: device.lastActive ? new Date(device.lastActive) : null,
        macAddress: canonicalizeMac(device.device),
        nickname: device.comment,
        wifiUserId: wifiUserId ?? null,
      })
      .onConflictDoNothing({ target: wifiDevice.macAddress });
  }
};

const importNas = async (tx: Transaction, aps: LegacyAp[]): Promise<void> => {
  for (const ap of aps) {
    await tx
      .insert(wifiNas)
      .values({
        comment: ap.comment,
        ipAddress: ap.IP,
        macAddress: canonicalizeMac(ap.AP),
      })
      .onConflictDoNothing({ target: wifiNas.macAddress });
  }
};

/**
 * One-shot import of a PetrikWiFi SQLite database into the Chronos wifi tables.
 *
 * Every write runs in one transaction: the legacy `wifi_user` username is
 * unique here too, so a failure part-way would leave rows that make a re-run
 * fail on that constraint instead of completing.
 *
 * Duplicate devices/NAS entries are skipped with `onConflictDoNothing`, not by
 * catching the constraint error: Postgres aborts the whole transaction on a
 * failed statement, so catching inside it would fail everything after.
 */
async function main() {
  const sqliteDbPath = process.env.PETRIKWIFI_DB_PATH;
  if (!sqliteDbPath) {
    logger.error('PETRIKWIFI_DB_PATH is not set.');
    process.exit(1);
  }

  const { aps, devices, users } = readLegacy(new Database(sqliteDbPath));
  const lookups = await buildLookups();

  await db.transaction(async (tx) => {
    const userIdMap = await importUsers(tx, users, lookups);
    await importDevices(tx, devices, userIdMap);
    await importNas(tx, aps);
  });

  logger.info('Imported {users} users, {devices} devices and {nas} NAS rows', {
    devices: devices.length,
    nas: aps.length,
    users: users.length,
  });
  process.exit(0);
}

main().catch((error) => {
  logger.error('PetrikWiFi migration failed: {error}', { error });
  process.exitCode = 1;
});
