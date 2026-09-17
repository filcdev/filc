import { Database } from 'bun:sqlite';
import { db } from '../src/database';
import { user as systemUser } from '../src/database/schema/authentication';
import { wifiDevice, wifiNas, wifiUser } from '../src/database/schema/wifi';
import { canonicalizeMac } from '../src/utils/wifi/mac';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy migration script
async function main() {
  const sqliteDbPath = process.env.PETRIKWIFI_DB_PATH;
  if (!sqliteDbPath) {
    process.exit(1);
  }
  const sqlite = new Database(sqliteDbPath);

  // biome-ignore lint/suspicious/noExplicitAny: Raw SQLite query
  const users = sqlite.query('SELECT * FROM Users').all() as any[];

  // We need to map old SQLite integer userID to new UUIDs
  const userIdMap = new Map<number, string>();

  const existingUsers = await db
    .select({ email: systemUser.email, id: systemUser.id })
    .from(systemUser);

  const emailToId = new Map(
    existingUsers.map((u) => [u.email.toLowerCase(), u.id])
  );
  const usernameToId = new Map(
    existingUsers.map((u) => [
      (u.email.split('@')[0] || '').toLowerCase(),
      u.id,
    ])
  );

  for (const user of users) {
    const wifiUsername = (user.username || '').toLowerCase();
    const userId =
      emailToId.get(wifiUsername) || usernameToId.get(wifiUsername) || null;

    const allowedDevices = user.allowedDevices
      ? JSON.parse(user.allowedDevices)
      : [];

    const [inserted] = await db
      .insert(wifiUser)
      .values({
        allowedMacAddresses: allowedDevices,
        banned: Boolean(user.banned),
        comment: user.comment,
        createdBy: userId || null,
        encryptedPassword: user.password,
        salt: user.salt,
        userId: userId || null,
        username: user.username,
      })
      .returning({ id: wifiUser.id });

    if (inserted) {
      userIdMap.set(user.userID, inserted.id);
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Raw SQLite query
  const devices = sqlite.query('SELECT * FROM Devices').all() as any[];

  for (const device of devices) {
    const macAddress = canonicalizeMac(device.device);
    const wifiUserId = userIdMap.get(device.userID);
    if (!(wifiUserId || device.banned)) {
      continue;
    }

    const lastActiveAt = device.lastActive ? new Date(device.lastActive) : null;

    try {
      await db.insert(wifiDevice).values({
        banned: Boolean(device.banned),
        lastActiveAt,
        macAddress,
        nickname: device.comment,
        wifiUserId: wifiUserId || null,
      });
      // biome-ignore lint/suspicious/noExplicitAny: Raw error check
    } catch (e: any) {
      if (e.message?.includes('duplicate key value')) {
        // Ignore duplicate device entries
      } else {
        throw e;
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Raw SQLite query
  const aps = sqlite.query('SELECT * FROM APs').all() as any[];

  for (const ap of aps) {
    const macAddress = canonicalizeMac(ap.AP);
    try {
      await db.insert(wifiNas).values({
        comment: ap.comment,
        ipAddress: ap.IP,
        macAddress,
      });
      // biome-ignore lint/suspicious/noExplicitAny: Raw error check
    } catch (e: any) {
      if (e.message?.includes('duplicate key value')) {
        // Ignore duplicate NAS entries
      } else {
        throw e;
      }
    }
  }
  process.exit(0);
}

// biome-ignore lint/suspicious/noConsole: Migration script entrypoint
main().catch(console.error);
