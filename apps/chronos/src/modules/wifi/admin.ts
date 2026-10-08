import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { requireWifiEnabled } from '#middleware/wifi';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, notFound, serviceUnavailable } from '#utils/http';
import {
  wifiAuthLog,
  wifiDevice,
  wifiNas,
  wifiRoleSpeedProfile,
  wifiSpeedProfile,
  wifiUser,
} from './schema';
import { getWifiController, type WifiSpeedProfile } from './utils/controller';
import { encryptPassword } from './utils/encryptor';
import { canonicalizeMac } from './utils/mac';

/**
 * `exactOptionalPropertyTypes` rejects an explicit `undefined` for an optional
 * Drizzle column, and a `.partial()` payload carries every field the caller
 * omitted as `undefined`. Drop them instead of narrowing each handler to a
 * hand-written assignment per field.
 */
const presentFields = <T extends object>(
  value: T
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

const configured = () => {
  const controller = getWifiController();
  if (!controller) {
    throw serviceUnavailable('No WiFi controller is configured');
  }
  return controller;
};

/**
 * `wifi_user` has no `last_active_at` column — activity belongs to the devices.
 * The wire field is the most recent of the account's devices, so the list is
 * one query with the aggregate inlined instead of a second round trip.
 */
const lastActiveAtSubquery = sql<Date | null>`(select max(${wifiDevice.lastActiveAt}) from ${wifiDevice} where ${wifiDevice.wifiUserId} = ${wifiUser.id})`;

const userColumns = {
  ...getTableColumns(wifiUser),
  creatorName: user.name,
  lastActiveAt: lastActiveAtSubquery,
};

const fetchUserById = async (id: string) => {
  const [row] = await db
    .select(userColumns)
    .from(wifiUser)
    .leftJoin(user, eq(wifiUser.createdBy, user.id))
    .where(eq(wifiUser.id, id))
    .limit(1);
  return row;
};

const serializeSpeedProfile = (
  profile: WifiSpeedProfile | undefined,
  isWlanDefault = false
) => {
  if (!profile) {
    throw serviceUnavailable('UniFi did not return a speed profile');
  }
  return {
    downloadSpeedMbps: profile.downloadSpeedMbps ?? null,
    id: profile.id,
    isWlanDefault,
    name: profile.name,
    uploadSpeedMbps: profile.uploadSpeedMbps ?? null,
  };
};

export const listWifiUsers = base.wifi.users.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async ({ input }) => {
    const { limit, offset, search } = input;
    const users = await db
      .select(userColumns)
      .from(wifiUser)
      .leftJoin(user, eq(wifiUser.createdBy, user.id))
      .where(search ? ilike(wifiUser.username, `%${search}%`) : undefined)
      .orderBy(asc(wifiUser.createdAt))
      .limit(limit)
      .offset(offset);

    return { users };
  });

export const createWifiUser = base.wifi.users.create
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ context, input }) => {
    if (!env.wifiEncryptionSecret) {
      throw serviceUnavailable('WiFi encryption is not configured');
    }

    const encrypted = await encryptPassword(
      input.password,
      input.username,
      env.wifiEncryptionSecret
    );

    const [created] = await db
      .insert(wifiUser)
      .values({
        allowedMacAddresses: input.allowedMacAddresses,
        comment: input.comment,
        createdBy: context.session.userId,
        encryptedPassword: encrypted.encryptedPassword,
        salt: encrypted.salt,
        speedProfileId: input.speedProfileId,
        userId: input.userId,
        username: input.username,
      })
      .returning({ id: wifiUser.id });

    if (!created) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create WiFi user',
        status: 500,
      });
    }

    const row = await fetchUserById(created.id);
    if (!row) {
      throw notFound('WiFi user not found');
    }

    return { user: row };
  });

export const updateWifiUser = base.wifi.users.update
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const { id, password, ...fields } = input;
    const [existing] = await db
      .select()
      .from(wifiUser)
      .where(eq(wifiUser.id, id))
      .limit(1);
    if (!existing) {
      throw notFound('WiFi user not found');
    }
    if (fields.username && fields.username !== existing.username && !password) {
      throw badRequest('Changing the username requires changing the password');
    }

    const update: Partial<typeof wifiUser.$inferInsert> = {
      ...presentFields(fields),
      updatedAt: new Date(),
    };
    if (password) {
      const username = fields.username ?? existing.username;
      if (!env.wifiEncryptionSecret) {
        throw badRequest(
          'Username and encryption configuration are required to change the password'
        );
      }
      const encrypted = await encryptPassword(
        password,
        username,
        env.wifiEncryptionSecret
      );
      update.encryptedPassword = encrypted.encryptedPassword;
      update.salt = encrypted.salt;
    }

    const [updated] = await db
      .update(wifiUser)
      .set(update)
      .where(eq(wifiUser.id, id))
      .returning({ id: wifiUser.id });
    if (!updated) {
      throw notFound('WiFi user not found');
    }

    const row = await fetchUserById(updated.id);
    if (!row) {
      throw notFound('WiFi user not found');
    }

    return { user: row };
  });

export const deleteWifiUser = base.wifi.users.delete
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [deleted] = await db
      .delete(wifiUser)
      .where(eq(wifiUser.id, input.id))
      .returning({ id: wifiUser.id });
    if (!deleted) {
      throw notFound('WiFi user not found');
    }

    return { id: deleted.id };
  });

/** `null` means "unowned devices"; `undefined` means "no owner filter". */
const ownerFilter = (wifiUserId: string | null | undefined) => {
  if (wifiUserId === null) {
    return isNull(wifiDevice.wifiUserId);
  }
  if (wifiUserId === undefined) {
    return undefined;
  }
  return eq(wifiDevice.wifiUserId, wifiUserId);
};

export const listWifiDevices = base.wifi.devices.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async ({ input }) => {
    const { limit, offset, search, wifiUserId } = input;
    const devices = await db
      .select()
      .from(wifiDevice)
      .where(
        and(
          search ? ilike(wifiDevice.macAddress, `%${search}%`) : undefined,
          ownerFilter(wifiUserId)
        )
      )
      .orderBy(desc(wifiDevice.updatedAt))
      .limit(limit)
      .offset(offset);

    return { devices };
  });

export const createWifiDevice = base.wifi.devices.create
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [device] = await db
      .insert(wifiDevice)
      .values({ ...input, macAddress: canonicalizeMac(input.macAddress) })
      .returning();
    if (!device) {
      throw notFound('WiFi device not found');
    }

    return { device };
  });

export const updateWifiDevice = base.wifi.devices.update
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const { id, macAddress, ...fields } = input;
    const [device] = await db
      .update(wifiDevice)
      .set({
        ...fields,
        ...(macAddress ? { macAddress: canonicalizeMac(macAddress) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(wifiDevice.id, id))
      .returning();
    if (!device) {
      throw notFound('WiFi device not found');
    }

    return { device };
  });

export const deleteWifiDevice = base.wifi.devices.delete
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [deleted] = await db
      .delete(wifiDevice)
      .where(eq(wifiDevice.id, input.id))
      .returning({ id: wifiDevice.id });
    if (!deleted) {
      throw notFound('WiFi device not found');
    }

    return { id: deleted.id };
  });

export const listWifiNas = base.wifi.nas.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async () => ({
    nas: await db.select().from(wifiNas).orderBy(asc(wifiNas.ipAddress)),
  }));

export const createWifiNas = base.wifi.nas.create
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [nas] = await db
      .insert(wifiNas)
      .values({ ...input, macAddress: canonicalizeMac(input.macAddress) })
      .returning();
    if (!nas) {
      throw notFound('WiFi NAS not found');
    }

    return { nas };
  });

export const updateWifiNas = base.wifi.nas.update
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const { id, macAddress, ...fields } = input;
    const [nas] = await db
      .update(wifiNas)
      .set({
        ...fields,
        ...(macAddress ? { macAddress: canonicalizeMac(macAddress) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(wifiNas.id, id))
      .returning();
    if (!nas) {
      throw notFound('WiFi NAS not found');
    }

    return { nas };
  });

export const deleteWifiNas = base.wifi.nas.delete
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [deleted] = await db
      .delete(wifiNas)
      .where(eq(wifiNas.id, input.id))
      .returning({ id: wifiNas.id });
    if (!deleted) {
      throw notFound('WiFi NAS not found');
    }

    return { id: deleted.id };
  });

export const listWifiSpeedProfiles = base.wifi.speedProfiles.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async () => {
    const profiles = await db
      .select()
      .from(wifiSpeedProfile)
      .orderBy(asc(wifiSpeedProfile.name));

    return {
      speedProfiles: profiles.map((profile) =>
        serializeSpeedProfile(
          {
            downloadSpeedMbps: profile.downloadSpeedMbps,
            id: profile.id,
            name: profile.name,
            uploadSpeedMbps: profile.uploadSpeedMbps,
          },
          profile.isWlanDefault
        )
      ),
    };
  });

export const createWifiSpeedProfile = base.wifi.speedProfiles.create
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const profile = await configured().createSpeedProfile(input);

    await db.insert(wifiSpeedProfile).values({
      downloadSpeedMbps: profile.downloadSpeedMbps ?? null,
      id: profile.id,
      isWlanDefault: false,
      name: profile.name,
      uploadSpeedMbps: profile.uploadSpeedMbps ?? null,
    });

    return { profile: serializeSpeedProfile(profile) };
  });

export const updateWifiSpeedProfile = base.wifi.speedProfiles.update
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const controller = configured();
    const [current] = await db
      .select()
      .from(wifiSpeedProfile)
      .where(eq(wifiSpeedProfile.id, input.id))
      .limit(1);
    if (!current) {
      throw notFound('WiFi speed profile not found');
    }

    const profile = await controller.updateSpeedProfile(input.id, {
      downloadSpeedMbps:
        input.downloadSpeedMbps ?? current.downloadSpeedMbps ?? -1,
      name: input.name ?? current.name,
      uploadSpeedMbps: input.uploadSpeedMbps ?? current.uploadSpeedMbps ?? -1,
    });

    const [updated] = await db
      .update(wifiSpeedProfile)
      .set({
        downloadSpeedMbps: profile.downloadSpeedMbps ?? null,
        name: profile.name,
        syncedAt: new Date(),
        uploadSpeedMbps: profile.uploadSpeedMbps ?? null,
      })
      .where(eq(wifiSpeedProfile.id, profile.id))
      .returning({ isWlanDefault: wifiSpeedProfile.isWlanDefault });

    return {
      profile: serializeSpeedProfile(profile, updated?.isWlanDefault ?? false),
    };
  });

export const deleteWifiSpeedProfile = base.wifi.speedProfiles.delete
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    await configured().deleteSpeedProfile(input.id);
    await db.delete(wifiSpeedProfile).where(eq(wifiSpeedProfile.id, input.id));

    return { id: input.id };
  });

export const listWifiRoleProfiles = base.wifi.roleSpeedProfiles.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async () => ({
    roleSpeedProfiles: await db
      .select()
      .from(wifiRoleSpeedProfile)
      .orderBy(desc(wifiRoleSpeedProfile.priority)),
  }));

export const createWifiRoleProfile = base.wifi.roleSpeedProfiles.create
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [mapping] = await db
      .insert(wifiRoleSpeedProfile)
      .values(input)
      .returning();
    if (!mapping) {
      throw notFound('WiFi role mapping not found');
    }

    return { mapping };
  });

export const updateWifiRoleProfile = base.wifi.roleSpeedProfiles.update
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const { id, ...fields } = input;
    const [mapping] = await db
      .update(wifiRoleSpeedProfile)
      .set(fields)
      .where(eq(wifiRoleSpeedProfile.roleName, id))
      .returning();
    if (!mapping) {
      throw notFound('WiFi role mapping not found');
    }

    return { mapping };
  });

export const deleteWifiRoleProfile = base.wifi.roleSpeedProfiles.delete
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiWrite))
  .handler(async ({ input }) => {
    const [deleted] = await db
      .delete(wifiRoleSpeedProfile)
      .where(eq(wifiRoleSpeedProfile.roleName, input.id))
      .returning({ roleName: wifiRoleSpeedProfile.roleName });
    if (!deleted) {
      throw notFound('WiFi role mapping not found');
    }

    return { id: deleted.roleName };
  });

export const listWifiAuthLogs = base.wifi.authLogs.list
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async ({ input }) => {
    const { limit, offset, search, failureReason, result } = input;
    const logs = await db
      .select({
        deviceNickname: wifiDevice.nickname,
        deviceReportedHostname: wifiDevice.reportedHostname,
        failureReason: wifiAuthLog.failureReason,
        id: wifiAuthLog.id,
        macAddress: wifiAuthLog.macAddress,
        nasComment: wifiNas.comment,
        nasIpAddress: wifiAuthLog.nasIpAddress,
        nasMacAddress: wifiAuthLog.nasMacAddress,
        result: wifiAuthLog.result,
        timestamp: wifiAuthLog.timestamp,
        userComment: wifiUser.comment,
        username: wifiAuthLog.username,
        wifiUserId: wifiAuthLog.wifiUserId,
      })
      .from(wifiAuthLog)
      .leftJoin(
        wifiNas,
        or(
          eq(wifiAuthLog.nasIpAddress, wifiNas.ipAddress),
          eq(wifiAuthLog.nasMacAddress, wifiNas.macAddress)
        )
      )
      .leftJoin(wifiDevice, eq(wifiAuthLog.macAddress, wifiDevice.macAddress))
      .leftJoin(wifiUser, eq(wifiAuthLog.username, wifiUser.username))
      .where(
        and(
          search
            ? or(
                ilike(wifiAuthLog.username, `%${search}%`),
                ilike(wifiAuthLog.macAddress, `%${search}%`),
                ilike(wifiAuthLog.nasIpAddress, `%${search}%`),
                ilike(wifiAuthLog.failureReason, `%${search}%`)
              )
            : undefined,
          failureReason
            ? eq(wifiAuthLog.failureReason, failureReason)
            : undefined,
          result === undefined ? undefined : eq(wifiAuthLog.result, result)
        )
      )
      .orderBy(desc(wifiAuthLog.timestamp))
      .limit(limit)
      .offset(offset);

    return { logs };
  });
