import { and, lt, notExists, sql } from 'drizzle-orm';
import { db } from '#database';
import { env } from '#utils/environment';
import { wifiSpeedProfile, wifiUser } from '../schema';
import { SPEED_PROFILE_NONE } from './constants';
import { getWifiController } from './controller';

/**
 * Mirror the UniFi controller's speed profiles into the local table.
 *
 * The whole run is one transaction: a fetch or upsert that fails part-way would
 * otherwise leave a partial set of rows, and the closing delete removes every
 * profile the run did not touch — i.e. everything, if the upserts never ran.
 */
export async function syncSpeedProfiles() {
  const controller = getWifiController();
  if (!controller) {
    return;
  }

  const profiles = await controller.getSpeedProfiles();
  let defaultProfileId: string | null = null;
  if (env.wifiSsid) {
    defaultProfileId = await controller.getWlanDefaultSpeedProfile(
      env.wifiSsid
    );
  }
  const syncedAt = new Date();

  await db.transaction(async (tx) => {
    // Upsert all fetched profiles
    for (const profile of profiles) {
      const isWlanDefault = profile.id === defaultProfileId;
      await tx
        .insert(wifiSpeedProfile)
        .values({
          downloadSpeedMbps: profile.downloadSpeedMbps ?? null,
          id: profile.id,
          isWlanDefault,
          name: profile.name,
          syncedAt,
          uploadSpeedMbps: profile.uploadSpeedMbps ?? null,
        })
        .onConflictDoUpdate({
          set: {
            downloadSpeedMbps: profile.downloadSpeedMbps ?? null,
            isWlanDefault,
            name: profile.name,
            syncedAt,
            uploadSpeedMbps: profile.uploadSpeedMbps ?? null,
          },
          target: wifiSpeedProfile.id,
        });
    }

    // Delete profiles that no longer exist in the controller
    await tx
      .delete(wifiSpeedProfile)
      .where(lt(wifiSpeedProfile.syncedAt, syncedAt));

    // `wifi_user.speed_profile_id` has no foreign key (the module stores its
    // `__none__` sentinel there), so the delete above can orphan a reference.
    // The sentinel is not a profile id and must survive: it means "no limit",
    // which is not the same as the role/wlan-default fallback a null takes.
    await tx
      .update(wifiUser)
      .set({ speedProfileId: null })
      .where(
        and(
          sql`${wifiUser.speedProfileId} <> ${SPEED_PROFILE_NONE}`,
          notExists(
            tx
              .select()
              .from(wifiSpeedProfile)
              .where(sql`${wifiSpeedProfile.id} = ${wifiUser.speedProfileId}`)
          )
        )
      );
  });
}
