import { getLogger } from '@logtape/logtape';
import dayjs from 'dayjs';
import { db, prepareDb } from '#database/index';
import { user } from '#database/schema/authentication';
import { auditLog, card, cardDevice, device } from '#database/schema/doorlock';
import { configureLogger } from '#utils/logger';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'seed-doorlock']);

await prepareDb();

// Get existing users
const users = await db.select().from(user);
if (users.length === 0) {
  logger.error('No users found — register first');
  process.exit(1);
}

const deviceData = [
  {
    apiToken: crypto.randomUUID(),
    id: crypto.randomUUID(),
    location: 'Főbejárat',
    name: 'Main Entrance',
  },
  {
    apiToken: crypto.randomUUID(),
    id: crypto.randomUUID(),
    location: 'Tornaterem',
    name: 'Gym',
  },
  {
    apiToken: crypto.randomUUID(),
    id: crypto.randomUUID(),
    location: 'Könyvtár',
    name: 'Library',
  },
];

// Create devices
await db.insert(device).values(deviceData).onConflictDoNothing();
const allDevices = await db.select().from(device);
logger.info(`${allDevices.length} devices available`);

// Create cards for users
for (let i = 0; i < Math.min(users.length, 5); i++) {
  const u = users[i];
  if (!u) {
    continue;
  }
  await db
    .insert(card)
    .values({
      cardData: `${i + 1}${'0'.repeat(7)}ABCD`,
      enabled: true,
      frozen: i === 2,
      name: `${u.name ?? 'User'}s Card`,
      userId: u.id,
    })
    .onConflictDoNothing();
}
const allCards = await db.select().from(card);
logger.info(`${allCards.length} cards available`);

// Create card-device relationships
for (const c of allCards) {
  for (const d of allDevices) {
    if (Math.random() < 0.7) {
      await db
        .insert(cardDevice)
        .values({ cardId: c.id, deviceId: d.id })
        .onConflictDoNothing();
    }
  }
}
logger.info('Card-device relations seeded');

// Create audit logs for the past 7 days
let logCount = 0;
const now = dayjs();
for (let day = 0; day < 7; day++) {
  const logsPerDay = 3 + Math.floor(Math.random() * 8);
  for (let i = 0; i < logsPerDay; i++) {
    const c = allCards[Math.floor(Math.random() * allCards.length)];
    const d = allDevices[Math.floor(Math.random() * allDevices.length)];
    if (!(c && d)) {
      continue;
    }
    const hour = 7 + Math.floor(Math.random() * 12);
    const minute = Math.floor(Math.random() * 60);
    const timestamp = now
      .subtract(day, 'day')
      .hour(hour)
      .minute(minute)
      .second(0)
      .toDate();
    const success = Math.random() > 0.15;
    await db.insert(auditLog).values({
      buttonPressed: Math.random() < 0.2,
      cardData: c.cardData,
      cardId: c.id,
      deviceId: d.id,
      result: success,
      timestamp,
      userId: c.userId,
    });
    logCount++;
  }
}
logger.info(`Created ${logCount} audit logs`);

// Add anonymous logs with no user (unknown cards in 00:00:00:00 format)
const fakeUIDs = [
  'AA:BB:CC:DD',
  '11:22:33:44',
  'F0:E1:D2:C3',
  '00:00:00:00',
  'A1:B2:C3:D4',
  'DE:AD:BE:EF',
  'CA:FE:BA:BE',
  '01:23:45:67',
  'FE:DC:BA:98',
  '12:34:56:78',
];

let anonCount = 0;
for (let day = 0; day < 7; day++) {
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const d = allDevices[Math.floor(Math.random() * allDevices.length)];
    if (!d) {
      continue;
    }
    const uid = fakeUIDs[Math.floor(Math.random() * fakeUIDs.length)];
    const hour = 6 + Math.floor(Math.random() * 14);
    const ts = now
      .subtract(day, 'day')
      .hour(hour)
      .minute(Math.floor(Math.random() * 60))
      .second(0)
      .toDate();
    await db.insert(auditLog).values({
      buttonPressed: Math.random() < 0.3,
      cardData: uid,
      cardId: null,
      deviceId: d.id,
      result: Math.random() > 0.3,
      timestamp: ts,
      userId: null,
    });
    anonCount++;
  }
}
logger.info(`Created ${anonCount} anonymous logs`);

logger.info('Doorlock seed complete!');
process.exit(0);
