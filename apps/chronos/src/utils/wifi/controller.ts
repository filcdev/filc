import { env } from '#utils/environment';
import { createUnifiController } from './unifi-controller';

export type WifiSpeedProfile = {
  id: string;
  name: string;
  downloadSpeedMbps: number | null;
  uploadSpeedMbps: number | null;
};

export type WifiSpeedProfileInput = {
  name: string;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
};

export type WifiController = {
  readonly provider: string;
  fetchClientHostname(macAddress: string): Promise<string | null>;
  updateClientName(macAddress: string, name: string): Promise<void>;
  applySpeedProfile(macAddress: string, speedProfileId: string): Promise<void>;
  getSpeedProfiles(): Promise<WifiSpeedProfile[]>;
  getWlanDefaultSpeedProfile(ssid: string): Promise<string | null>;
  createSpeedProfile(input: WifiSpeedProfileInput): Promise<WifiSpeedProfile>;
  updateSpeedProfile(
    id: string,
    input: WifiSpeedProfileInput
  ): Promise<WifiSpeedProfile>;
  deleteSpeedProfile(id: string): Promise<void>;
};

let controller: WifiController | null | undefined;

export const getWifiController = (): WifiController | null => {
  if (controller !== undefined) {
    return controller;
  }

  switch (env.wifiControllerProvider) {
    case 'unifi':
      if (
        !(
          env.unifiHost &&
          env.unifiPort &&
          env.unifiUsername &&
          env.unifiPassword
        )
      ) {
        controller = null;
        return controller;
      }
      controller = createUnifiController({
        host: env.unifiHost,
        insecureTls: env.unifiInsecureTls,
        password: env.unifiPassword,
        port: env.unifiPort,
        username: env.unifiUsername,
      });
      return controller;
    default:
      controller = null;
      return controller;
  }
};
