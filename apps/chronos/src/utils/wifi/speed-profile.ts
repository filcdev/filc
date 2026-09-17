import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  wifiRoleSpeedProfile,
  wifiSpeedProfile,
  type wifiUser,
} from '#database/schema/wifi';
import { SPEED_PROFILE_NONE } from './constants';

export type EffectiveSpeedProfile = {
  roleName: string | null;
  source: 'override' | 'role' | 'wlan_default';
  speedProfileId: string | null;
  downloadSpeedMbps: number | null;
  uploadSpeedMbps: number | null;
};

export const resolveEffectiveSpeedProfile = async (
  account: typeof wifiUser.$inferSelect
): Promise<string | null> => {
  const details = await resolveEffectiveSpeedProfileDetails(account);
  return details.speedProfileId;
};

const resolveLimits = async (profileId: string | null) => {
  if (!profileId || profileId === SPEED_PROFILE_NONE) {
    return { downloadSpeedMbps: null, uploadSpeedMbps: null };
  }
  const [profile] = await db
    .select({
      down: wifiSpeedProfile.downloadSpeedMbps,
      up: wifiSpeedProfile.uploadSpeedMbps,
    })
    .from(wifiSpeedProfile)
    .where(eq(wifiSpeedProfile.id, profileId))
    .limit(1);
  return {
    downloadSpeedMbps: profile?.down ?? null,
    uploadSpeedMbps: profile?.up ?? null,
  };
};

export const resolveEffectiveSpeedProfileDetails = async (
  account: typeof wifiUser.$inferSelect
): Promise<EffectiveSpeedProfile> => {
  let source: EffectiveSpeedProfile['source'] = 'wlan_default';
  let speedProfileId: string | null = null;
  let roleName: string | null = null;

  if (account.speedProfileId && account.speedProfileId !== SPEED_PROFILE_NONE) {
    source = 'override';
    speedProfileId = account.speedProfileId;
  } else if (account.speedProfileId !== SPEED_PROFILE_NONE && account.userId) {
    const [filcUser] = await db
      .select({ roles: user.roles })
      .from(user)
      .where(eq(user.id, account.userId))
      .limit(1);

    if (filcUser?.roles?.length) {
      const [mapping] = await db
        .select()
        .from(wifiRoleSpeedProfile)
        .where(inArray(wifiRoleSpeedProfile.roleName, filcUser.roles))
        .orderBy(desc(wifiRoleSpeedProfile.priority))
        .limit(1);

      if (mapping) {
        source = 'role';
        speedProfileId = mapping.speedProfileId;
        roleName = mapping.roleName;
      }
    }
  }

  // The controller itself will apply the wlan default speed limit.
  let limits = await resolveLimits(speedProfileId);

  if (source === 'wlan_default') {
    const [defaultProfile] = await db
      .select({
        down: wifiSpeedProfile.downloadSpeedMbps,
        up: wifiSpeedProfile.uploadSpeedMbps,
      })
      .from(wifiSpeedProfile)
      .where(eq(wifiSpeedProfile.isWlanDefault, true))
      .limit(1);

    if (defaultProfile) {
      limits = {
        downloadSpeedMbps: defaultProfile.down ?? null,
        uploadSpeedMbps: defaultProfile.up ?? null,
      };
    }
  }

  return {
    roleName,
    source,
    speedProfileId,
    ...limits,
  };
};
