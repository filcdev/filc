/** biome-ignore-all lint/style/noNestedTernary: b-but muh nested ternarey */
import fs from 'node:fs';
import path from 'node:path';
import { checkbox, confirm } from '@inquirer/prompts';
import { getLogger } from '@logtape/logtape';
import { Presets, SingleBar } from 'cli-progress';
import dayjs from 'dayjs';
import { eq, inArray } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import z from 'zod';
import { db, prepareDb } from '#database/index';
import { user } from '#database/schema/authentication';
import {
  auditLog,
  card,
  cardDevice,
  device,
  deviceHealth,
} from '#database/schema/doorlock';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { configureLogger } from '#utils/logger';
import { importTimetableXML } from '#utils/timetable/imports';
import { timetableExportRootSchema } from '#utils/timetable/schemas';

const CANCELLATION_PROBABILITY = 0.3;
const SUBSTITUTION_ROOM_PROBABILITY = 0.4;

await configureLogger('chronos');

const logger = getLogger(['chronos', 'drizzle']);

type BaseData = {
  cohorts: Array<{ id: string; name: string; timetableId: string }>;
  teachers: Array<{ id: string }>;
  days: Array<{ id: string }>;
  periods: Array<{ id: string }>;
  classrooms: Array<{ id: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  devices: Array<{ id: string; name: string; apiToken: string }>;
};

type SubstitutionParams = {
  cohortId: string;
  lessonId: string;
  index: number;
  date: string;
  teachers: Array<{ id: string }>;
};

type MovedLessonParams = {
  cohortId: string;
  lessonId: string;
  index: number;
  date: string;
  days: Array<{ id: string }>;
  periods: Array<{ id: string }>;
  classrooms: Array<{ id: string }>;
};

const generateDates = (): string[] => {
  const offsets = [1, 2, 3, 5, 7];

  return offsets.map((days) => dayjs().add(days, 'day').toISOString());
};

const fetchBaseData = async (): Promise<BaseData> => {
  const cohorts = await db.select().from(cohort);
  const teachers = await db.select().from(teacher);
  const days = await db.select().from(dayDefinition);
  const periods = await db.select().from(period);
  const classrooms = await db.select().from(classroom);
  const users = await db.select().from(user);
  const devices = await db.select().from(device);

  return { classrooms, cohorts, days, devices, periods, teachers, users };
};

const getCohortLessons = async (cohortId: string) => {
  const cohortLessonRelations = await db
    .select()
    .from(lessonCohortMTM)
    .where(eq(lessonCohortMTM.cohortId, cohortId))
    .limit(5);

  if (cohortLessonRelations.length === 0) {
    return [];
  }

  const lessonIds = cohortLessonRelations.map((rel) => rel.lessonId);
  return db.select().from(lesson).where(inArray(lesson.id, lessonIds));
};

const createSubstitution = async (params: SubstitutionParams) => {
  const isCancelled = Math.random() < CANCELLATION_PROBABILITY;
  const substituterId = isCancelled
    ? null
    : params.teachers[Math.floor(Math.random() * params.teachers.length)]?.id;

  const created = await db.transaction(async (tx) => {
    const [insertedSub] = await tx
      .insert(substitution)
      .values({
        date: params.date,
        id: `sub-${params.cohortId}-${params.lessonId}-${params.index}`,
        substituter: substituterId,
      })
      .returning();

    if (!insertedSub) {
      return null;
    }

    await tx.insert(substitutionLessonMTM).values({
      lessonId: params.lessonId,
      substitutionId: insertedSub.id,
    });

    return isCancelled ? 'cancelled' : 'substituted';
  });

  return created;
};

const createMovedLesson = async (params: MovedLessonParams) => {
  const targetDay =
    params.days.length > 0
      ? params.days[Math.floor(Math.random() * params.days.length)]?.id
      : null;
  const targetPeriod =
    params.periods.length > 0
      ? params.periods[Math.floor(Math.random() * params.periods.length)]?.id
      : null;
  const targetRoom =
    params.classrooms.length > 0 &&
    Math.random() > SUBSTITUTION_ROOM_PROBABILITY
      ? params.classrooms[Math.floor(Math.random() * params.classrooms.length)]
          ?.id
      : null;

  const created = await db.transaction(async (tx) => {
    const insertedMoved = await tx
      .insert(movedLesson)
      .values({
        date: params.date,
        id: `moved-${params.cohortId}-${params.lessonId}-${params.index}`,
        room: targetRoom,
        startingDay: targetDay,
        startingPeriod: targetPeriod,
      })
      .returning();

    const moved = insertedMoved[0];
    if (!moved) {
      return false;
    }

    await tx.insert(movedLessonLessonMTM).values({
      lessonId: params.lessonId,
      movedLessonId: moved.id,
    });

    return true;
  });

  return created;
};

const processCohortLessons = async (
  currentCohort: { id: string; name: string },
  dates: string[],
  baseData: BaseData
) => {
  const cohortLessons = await getCohortLessons(currentCohort.id);

  for (let i = 0; i < Math.min(3, cohortLessons.length); i++) {
    const selectedLesson = cohortLessons[i];
    if (!selectedLesson) {
      continue;
    }

    const date = dates[i % dates.length];
    if (!date) {
      continue;
    }

    const isSubstitution = Math.random() > 0.5;

    if (isSubstitution) {
      const result = await createSubstitution({
        cohortId: currentCohort.id,
        date,
        index: i,
        lessonId: selectedLesson.id,
        teachers: baseData.teachers,
      });

      if (result) {
        logger.info(
          `Created ${result} lesson for cohort ${currentCohort.name}`
        );
      }
    } else {
      const created = await createMovedLesson({
        classrooms: baseData.classrooms,
        cohortId: currentCohort.id,
        date,
        days: baseData.days,
        index: i,
        lessonId: selectedLesson.id,
        periods: baseData.periods,
      });

      if (created) {
        logger.info(`Created moved lesson for cohort ${currentCohort.name}`);
      }
    }
  }
};

const importBaseData = async () => {
  logger.info('Importing base timetable data...');

  const baseTimetableXmlPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'public',
    'timetables',
    'dev.xml'
  );

  const xmlBuffer = fs.readFileSync(baseTimetableXmlPath);
  const decoded = iconv.decode(xmlBuffer, 'win1250');
  const cleaned = decoded.replaceAll('Period=""', '');

  const parser = new XMLParser({
    attributeNamePrefix: '_',
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: true,
    textNodeName: 'text',
    trimValues: true,
  });

  const input = parser.parse(cleaned);
  const data = z.parse(timetableExportRootSchema, input);

  await importTimetableXML(data, {
    name: 'Default Timetable',
    validFrom: dayjs().toISOString(),
  });

  logger.info('Base data imported.');
};

const seedLessons = async (baseData: BaseData) => {
  const dates = generateDates();

  for (const currentCohort of baseData.cohorts) {
    await processCohortLessons(currentCohort, dates, baseData);
  }
};

const seedDoorlockDevices = async (): Promise<
  Array<{ id: string; name: string; apiToken: string }>
> => {
  const deviceData = [
    {
      apiToken: crypto.randomUUID(),
      id: crypto.randomUUID(),
      location: 'Main Building - Entrance',
      name: 'Main Entrance',
    },
    {
      apiToken: crypto.randomUUID(),
      id: crypto.randomUUID(),
      location: 'Science Wing - Floor 2',
      name: 'Lab Access',
    },
    {
      apiToken: crypto.randomUUID(),
      id: crypto.randomUUID(),
      location: 'Administration - Floor 1',
      name: 'Admin Office',
    },
    {
      apiToken: crypto.randomUUID(),
      id: crypto.randomUUID(),
      location: 'Gym Building',
      name: 'Gym Entrance',
    },
  ];

  const created = await db.insert(device).values(deviceData).returning();

  logger.info(`Created ${created.length} doorlock devices`);
  return created;
};

const seedDoorlockCards = async (
  baseData: BaseData
): Promise<Array<{ id: string; userId: string; cardData: string }>> => {
  if (baseData.users.length === 0) {
    logger.warn('No users found to create cards for');
    return [];
  }

  const cardsToCreate = baseData.users.slice(0, 10).map((currentUser, idx) => ({
    cardData: `${(idx + 1).toString().padStart(8, '0')}ABCD`,
    enabled: Math.random() > 0.1, // 90% enabled
    frozen: Math.random() < 0.05, // 5% frozen
    id: crypto.randomUUID(),
    name: `${currentUser.name}'s Card`,
    userId: currentUser.id,
  }));

  const created = await db
    .insert(card)
    .values(cardsToCreate)
    .onConflictDoNothing()
    .returning();

  logger.info(`Created ${created.length} access cards`);
  return created;
};

const seedCardDeviceRelations = async (
  cards: Array<{ id: string }>,
  devices: Array<{ id: string }>
) => {
  if (cards.length === 0 || devices.length === 0) {
    logger.warn('No cards or devices to create relationships for');
    return;
  }

  const relations: Array<{ cardId: string; deviceId: string }> = [];

  for (const currentCard of cards) {
    // Each card gets access to 1-3 random devices
    const accessCount = Math.floor(Math.random() * 3) + 1;
    const shuffledDevices = [...devices].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(accessCount, shuffledDevices.length); i++) {
      const selectedDevice = shuffledDevices[i];
      if (selectedDevice) {
        relations.push({
          cardId: currentCard.id,
          deviceId: selectedDevice.id,
        });
      }
    }
  }

  await db.insert(cardDevice).values(relations);
  logger.info(`Created ${relations.length} card-device relationships`);
};

const seedAuditLogs = async (
  cards: Array<{ id: string; userId: string; cardData: string }>,
  devices: Array<{ id: string }>
) => {
  if (cards.length === 0 || devices.length === 0) {
    logger.warn('No cards or devices to create audit logs for');
    return;
  }

  const logs: Array<{
    buttonPressed: boolean;
    cardData: string | null;
    cardId: string | null;
    deviceId: string;
    result: boolean;
    timestamp: Date;
    userId: string | null;
  }> = [];

  // Generate logs for the past 7 days
  const now = dayjs();
  const logCount = 50 + Math.floor(Math.random() * 50); // 50-100 logs

  for (let i = 0; i < logCount; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);

    const timestamp = now
      .subtract(daysAgo, 'day')
      .subtract(hoursAgo, 'hour')
      .subtract(minutesAgo, 'minute')
      .toDate();

    const selectedDevice = devices[Math.floor(Math.random() * devices.length)];
    if (!selectedDevice) {
      continue;
    }

    // 10% button presses without card
    const isButtonPress = Math.random() < 0.1;

    if (isButtonPress) {
      logs.push({
        buttonPressed: true,
        cardData: null,
        cardId: null,
        deviceId: selectedDevice.id,
        result: true, // Button presses always succeed
        timestamp,
        userId: null,
      });
    } else {
      const selectedCard = cards[Math.floor(Math.random() * cards.length)];
      if (!selectedCard) {
        continue;
      }

      // 85% success rate for card scans
      const isSuccess = Math.random() < 0.85;

      logs.push({
        buttonPressed: false,
        cardData: selectedCard.cardData,
        cardId: selectedCard.id,
        deviceId: selectedDevice.id,
        result: isSuccess,
        timestamp,
        userId: selectedCard.userId,
      });
    }
  }

  // Sort by timestamp
  logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  await db.insert(auditLog).values(logs);
  logger.info(`Created ${logs.length} audit log entries`);
};

const seedUsers = async (): Promise<
  Array<{ id: string; name: string; email: string }>
> => {
  const sampleUsers = [
    { email: 'john.doe@school.edu', name: 'John Doe', nickname: 'Johnny' },
    { email: 'jane.smith@school.edu', name: 'Jane Smith', nickname: 'Janie' },
    {
      email: 'mike.johnson@school.edu',
      name: 'Mike Johnson',
      nickname: 'Mikey',
    },
    {
      email: 'sarah.williams@school.edu',
      name: 'Sarah Williams',
      nickname: 'Sarah',
    },
    { email: 'david.brown@school.edu', name: 'David Brown', nickname: 'Dave' },
    { email: 'emily.davis@school.edu', name: 'Emily Davis', nickname: 'Em' },
    {
      email: 'james.wilson@school.edu',
      name: 'James Wilson',
      nickname: 'Jim',
    },
    {
      email: 'lisa.moore@school.edu',
      name: 'Lisa Moore',
      nickname: 'Lisa',
    },
    {
      email: 'robert.taylor@school.edu',
      name: 'Robert Taylor',
      nickname: 'Rob',
    },
    {
      email: 'mary.anderson@school.edu',
      name: 'Mary Anderson',
      nickname: 'Mary',
    },
  ];

  const usersToCreate = sampleUsers.map((u) => ({
    email: u.email,
    emailVerified: true,
    id: crypto.randomUUID(),
    name: u.name,
    nickname: u.nickname,
    roles: ['user'],
  }));

  const created = await db.insert(user).values(usersToCreate).returning();
  logger.info(`Created ${created.length} sample users`);
  return created;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: just read the code, brutal
const seedDeviceHealth = async (devices: Array<{ id: string }>) => {
  if (devices.length === 0) {
    logger.warn('No devices to create health records for');
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: not prod code
  const healthRecords: any[] = [];
  const now = dayjs();
  const twoWeeksAgo = now.subtract(14, 'day');
  const intervalSeconds = 30;
  const totalIntervals = Math.floor((14 * 24 * 60 * 60) / intervalSeconds); // 40,320 intervals

  logger.info(
    `Generating ${totalIntervals * devices.length} health records (2 weeks @ 30s intervals)...`
  );

  for (const currentDevice of devices) {
    // Generate device characteristics that evolve over time
    const baseRamFree = Math.floor(Math.random() * 30_000) + 20_000;
    const baseStorageUsed = Math.floor(Math.random() * 1_048_576) + 1_048_576;
    const fwVersion = `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`;

    let uptime = 0;
    let lastResetReason = 'power_on';

    for (let i = 0; i < totalIntervals; i++) {
      const timestamp = twoWeeksAgo.add(i * intervalSeconds, 'second').toDate();

      // 0.5% chance of errors per interval, 0.1% chance of reboot
      const willReboot = Math.random() < 0.001;
      const hasErrors = Math.random() < 0.005;

      const deviceState = hasErrors
        ? 'error'
        : willReboot
          ? 'booting'
          : Math.random() < 0.002
            ? 'updating'
            : 'idle';

      // Reset uptime on reboot
      if (willReboot) {
        uptime = 0;
        lastResetReason = ['software', 'watchdog', 'power_on'][
          Math.floor(Math.random() * 3)
        ] as string;
      } else {
        uptime += intervalSeconds;
      }

      // RAM fluctuates slightly around base value
      const ramVariation = Math.floor(Math.random() * 10_000) - 5000;
      const ramFree = Math.max(10_000, baseRamFree + ramVariation);

      // Storage grows slowly over time
      const storageGrowth = Math.floor((i / totalIntervals) * 500_000);
      const storageUsed = Math.min(3_670_016, baseStorageUsed + storageGrowth);

      healthRecords.push({
        deviceId: currentDevice.id,
        deviceMeta: {
          debug: {
            deviceState: deviceState as
              | 'booting'
              | 'error'
              | 'idle'
              | 'updating',
            errors: {
              db: hasErrors && Math.random() < 0.3,
              nfc: hasErrors && Math.random() < 0.5,
              ota: false,
              sd: hasErrors && Math.random() < 0.2,
              wifi: hasErrors && Math.random() < 0.4,
            },
            lastResetReason,
          },
          fwVersion,
          // ramFree: BigInt(ramFree),
          ramFree,
          storage: {
            // total: BigInt(4_194_304), // 4MB
            total: 4_194_304, // 4MB
            // used: BigInt(storageUsed),
            used: storageUsed,
          },
          // uptime: BigInt(uptime),
          uptime,
        },
        timestamp,
      });
    }
  }

  // TODO: fix above BigInt issue with Drizzle
  // probably fixed in drizzle by the time we upgrade to v1
  const progressBar = new SingleBar({}, Presets.shades_classic);

  logger.info('Inserting device health records into database...');
  const timeStart = performance.now();
  const chunkSize = 1000;
  progressBar.start(healthRecords.length, 0);
  for (let i = 0; i < healthRecords.length; i += chunkSize) {
    const chunk = healthRecords.slice(i, i + chunkSize);
    await db.insert(deviceHealth).values(chunk);
    progressBar.update(Math.min(i + chunk.length, healthRecords.length));
  }
  progressBar.stop();
  const timeEnd = performance.now();

  logger.info(
    `Created ${healthRecords.length} device health records in ${(timeEnd - timeStart).toFixed(2)} ms`
  );
};

const seedDoorlock = async (baseData: BaseData) => {
  logger.info('Seeding doorlock module...');

  // Create devices first
  const createdDevices = await seedDoorlockDevices();

  // Create cards for users
  const createdCards = await seedDoorlockCards(baseData);

  // Create card-device relationships
  await seedCardDeviceRelations(createdCards, createdDevices);

  // Create audit logs
  await seedAuditLogs(createdCards, createdDevices);

  // Create device health records
  await seedDeviceHealth(createdDevices);

  logger.info('Doorlock module seeded successfully');
};

const handleUserCreation = async (
  modules: string[],
  baseData: BaseData
): Promise<BaseData> => {
  if (modules.includes('doorlock') && baseData.users.length === 0) {
    const createUsers = await confirm({
      message:
        'No users found. Do you want to create sample users for doorlock seeding?',
    });

    if (createUsers) {
      await seedUsers();
      return fetchBaseData();
    }
    logger.warn('Doorlock seeding requires users. Skipping doorlock module.');
    const doorlockIndex = modules.indexOf('doorlock');
    if (doorlockIndex > -1) {
      modules.splice(doorlockIndex, 1);
    }
  }
  return baseData;
};

const seed = async () => {
  await prepareDb();

  logger.info('Seeding database...');

  let baseData = await fetchBaseData();

  if (baseData.cohorts.length === 0 || baseData.teachers.length === 0) {
    const proceed = await confirm({
      message:
        'No base timetable data found. Do you want to import the default timetable?',
    });

    if (!proceed) {
      logger.info(
        "Seeding aborted by user. You'll need to import a timetable first."
      );
      process.exit(1);
    }

    await importBaseData();
    baseData = await fetchBaseData();
  }

  const modules = await checkbox({
    choices: [
      { name: 'Substitutions and Moved Lessons', value: 'lessons' },
      { name: 'Doorlock (Devices, Cards, Logs)', value: 'doorlock' },
      // Future modules can be added here
    ],
    message: 'Select which modules to seed:',
  });

  const moduleMapping = {
    doorlock: seedDoorlock,
    lessons: seedLessons,
  };

  if (modules.length === 0) {
    logger.info('No modules selected. Exiting seeding process.');
    process.exit(0);
  }

  // Handle user creation if needed for doorlock
  baseData = await handleUserCreation(modules, baseData);

  for (const module of modules) {
    const seedFunction = moduleMapping[module as keyof typeof moduleMapping];
    if (seedFunction) {
      logger.info(`Seeding module: ${module}...`);
      try {
        await seedFunction(baseData);
      } catch (error) {
        logger.error(`Error seeding module ${module}:`, { error });
      }
    }
  }

  logger.info('Database seeding completed!');
};

await seed();
