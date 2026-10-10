import { getLogger } from '@logtape/logtape';
import { captureException, flush } from '@sentry/bun';
import { env } from '#utils/environment';
import {
  UnifiApiError,
  UnifiClient,
  type UnifiClientDevice,
} from './unifi-api';

const logger = getLogger(['chronos', 'unifi']);
const isUnifiConfigured = () => Boolean(env.unifiHost);

// Initialize directly. We skip explicit connect; it authenticates on first request.
export const unifi = new UnifiClient({
  baseUrl: `https://${env.unifiHost}:${env.unifiPort}`,
  insecureTls: env.unifiInsecureTls,
  password: env.unifiPassword || '',
  username: env.unifiUsername || '',
});

export async function updateUnifiClientName(mac: string, username: string) {
  if (!(env.unifiHost && mac && username)) {
    return;
  }

  try {
    const formattedMac = mac.toLowerCase().replaceAll('-', ':');
    let device: UnifiClientDevice[];

    try {
      device = await unifi.getClientDevice(formattedMac);
    } catch (error) {
      if (
        error instanceof UnifiApiError &&
        error.code === 'api.err.UnknownUser'
      ) {
        logger.error(`UNIFI: Device with MAC ${formattedMac} not found.`);
        return;
      }
      throw error;
    }

    if (device?.length !== 1) {
      logger.error(`UNIFI: Device with MAC ${formattedMac} not found`);
      return;
    }

    const client = device[0];
    if (!client) {
      return;
    }
    const newName = `${client.hostname ?? 'NoHostname'} - ${username}`;
    await unifi.setClientName(client._id, newName);
    logger.debug(`Updated client name for ${formattedMac} to "${newName}"`);
  } catch (error) {
    logger.error('Error updating client description: {error}', { error });
    captureException(error);
    await flush(10_000);
  }
}

export async function rebootLongRunningDevices() {
  if (!isUnifiConfigured()) {
    return;
  }
  try {
    const devices = await unifi.getAccessDevices();
    if (!devices?.length) {
      return logger.warn('No devices found.');
    }

    const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

    for (const device of devices) {
      if (device.adopted) {
        const uptimeDays = (device.uptime / (24 * 60 * 60)).toFixed(2);
        if (device.uptime > THIRTY_DAYS_IN_SECONDS) {
          logger.info(
            `[Rebooting] Device: ${device.name || device.mac} | Uptime: ${uptimeDays} days`
          );
          await unifi.restartDevice(device.mac, 'soft');
        } else {
          logger.debug(
            `[Skipping] Device: ${device.name || device.mac} | Uptime: ${uptimeDays} days`
          );
        }
      }
    }
  } catch (error) {
    logger.error('Error occurred in rebootLongRunningDevices: {error}', {
      error,
    });
    captureException(error);
    await flush(10_000);
  }
}

export async function getSpeedProfiles() {
  if (!isUnifiConfigured()) {
    return [];
  }
  try {
    return await unifi.getUserGroups();
  } catch (error) {
    logger.error('Error fetching speed profiles: {error}', { error });
    captureException(error);
    await flush(10_000);
    return [];
  }
}

export async function deleteSpeedProfile(id: string) {
  if (!isUnifiConfigured()) {
    return;
  }
  try {
    return await unifi.deleteUserGroup(id);
  } catch (error) {
    if (
      error instanceof UnifiApiError &&
      error.code === 'api.err.ObjectReferredBy'
    ) {
      logger.error(
        `Failed to delete speed profile with id ${id} because it is in use.`
      );
      const e = new Error(
        'Cannot delete speed profile because it is still in use by a client.'
      );
      throw Object.assign(e, { code: 'SPEED_PROFILE_IN_USE' });
    }
    logger.error('Error deleting speed profile: {error}', { error });
    captureException(error);
    await flush(10_000);
    throw error;
  }
}

export async function updateSpeedProfile(
  groupId: string,
  siteId: string,
  groupName: string,
  groupDn: number,
  groupUp: number
) {
  if (!isUnifiConfigured()) {
    return;
  }
  try {
    return await unifi.editUserGroup(
      groupId,
      siteId,
      groupName,
      groupDn,
      groupUp
    );
  } catch (error) {
    logger.error('Error updating speed profile: {error}', { error });
    captureException(error);
    await flush(10_000);
    throw error;
  }
}

export async function createSpeedProfile(
  groupName: string,
  groupDn = -1,
  groupUp = -1
) {
  if (!isUnifiConfigured()) {
    return;
  }
  try {
    return await unifi.createUserGroup(groupName, groupDn, groupUp);
  } catch (error) {
    logger.error('Error creating speed profile: {error}', { error });
    captureException(error);
    await flush(10_000);
    throw error;
  }
}
