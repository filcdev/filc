import { getLogger } from '@logtape/logtape';
import type {
  WifiController,
  WifiSpeedProfile,
  WifiSpeedProfileInput,
} from './controller';
import { UnifiClient } from './unifi-api';

const logger = getLogger(['chronos', 'wifi', 'unifi-controller']);

export class UnifiController implements WifiController {
  readonly provider = 'unifi';
  private readonly client: UnifiClient;

  constructor(client: UnifiClient) {
    this.client = client;
  }

  fetchClientHostname(macAddress: string) {
    return this.client.fetchClientHostname(macAddress);
  }

  async updateClientName(macAddress: string, name: string): Promise<void> {
    try {
      const devices = await this.client.getClientDevice(macAddress);
      const device = devices[0];
      if (device) {
        const newName = `${device.hostname ?? macAddress} - ${name}`;
        await this.client.setClientName(device._id, newName);
        logger.debug('Updated Unifi client name for {mac} to "{newName}"', {
          mac: macAddress,
          newName,
        });
      } else {
        logger.warn('Unifi client not found for MAC {mac}', {
          mac: macAddress,
        });
      }
    } catch (error) {
      logger.error('Error updating Unifi client name for {mac}: {error}', {
        error,
        mac: macAddress,
      });
    }
  }

  applySpeedProfile(macAddress: string, speedProfileId: string) {
    return this.client.applySpeedProfile(macAddress, speedProfileId);
  }

  async getSpeedProfiles(): Promise<WifiSpeedProfile[]> {
    const profiles = await this.client.getUserGroups();
    return profiles.map((profile) => ({
      downloadSpeedMbps:
        profile.qos_rate_max_down === undefined ||
        profile.qos_rate_max_down === -1
          ? null
          : Math.round(profile.qos_rate_max_down / 1000),
      id: profile._id,
      name: profile.name,
      uploadSpeedMbps:
        profile.qos_rate_max_up === undefined || profile.qos_rate_max_up === -1
          ? null
          : Math.round(profile.qos_rate_max_up / 1000),
    }));
  }

  async getWlanDefaultSpeedProfile(ssid: string): Promise<string | null> {
    const wlans = await this.client.getWlanConf();
    const wlan = wlans.find((w) => w.name === ssid);
    return wlan?.usergroup_id ?? null;
  }

  async createSpeedProfile(
    input: WifiSpeedProfileInput
  ): Promise<WifiSpeedProfile> {
    const profile = await this.client.createUserGroup(
      input.name,
      input.downloadSpeedMbps,
      input.uploadSpeedMbps
    );
    return {
      downloadSpeedMbps:
        profile.qos_rate_max_down === undefined ||
        profile.qos_rate_max_down === -1
          ? null
          : Math.round(profile.qos_rate_max_down / 1000),
      id: profile._id,
      name: profile.name,
      uploadSpeedMbps:
        profile.qos_rate_max_up === undefined || profile.qos_rate_max_up === -1
          ? null
          : Math.round(profile.qos_rate_max_up / 1000),
    };
  }

  async updateSpeedProfile(
    id: string,
    input: WifiSpeedProfileInput
  ): Promise<WifiSpeedProfile> {
    const profile = await this.client.editUserGroup(
      id,
      'default',
      input.name,
      input.downloadSpeedMbps,
      input.uploadSpeedMbps
    );
    return {
      downloadSpeedMbps:
        profile.qos_rate_max_down === undefined ||
        profile.qos_rate_max_down === -1
          ? null
          : Math.round(profile.qos_rate_max_down / 1000),
      id: profile._id,
      name: profile.name,
      uploadSpeedMbps:
        profile.qos_rate_max_up === undefined || profile.qos_rate_max_up === -1
          ? null
          : Math.round(profile.qos_rate_max_up / 1000),
    };
  }

  deleteSpeedProfile(id: string) {
    return this.client.deleteUserGroup(id);
  }
}

export const createUnifiController = (config: {
  host: string;
  insecureTls?: boolean;
  password: string;
  port: number;
  username: string;
}): WifiController =>
  new UnifiController(
    new UnifiClient({
      baseUrl: `https://${config.host}:${config.port}`,
      ...(config.insecureTls ? { insecureTls: true } : {}),
      password: config.password,
      username: config.username,
    })
  );
