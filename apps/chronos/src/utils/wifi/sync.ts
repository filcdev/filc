import { lt } from 'drizzle-orm';
import { db } from '#database';
import { wifiSpeedProfile } from '#database/schema/wifi';
import { getWifiController } from './controller';

export async function syncSpeedProfiles() {
  const controller = getWifiController();
  if (!controller) {
    return;
  }

  const profiles = await controller.getSpeedProfiles();
  let defaultProfileId: string | null = null;
  if (process.env.CHRONOS_WIFI_SSID) {
    defaultProfileId = await controller.getWlanDefaultSpeedProfile(
      process.env.CHRONOS_WIFI_SSID
    );
  }
  const syncedAt = new Date();

  // Upsert all fetched profiles
  for (const profile of profiles) {
    const isWlanDefault = profile.id === defaultProfileId;
    await db
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
  await db
    .delete(wifiSpeedProfile)
    .where(lt(wifiSpeedProfile.syncedAt, syncedAt));
}
