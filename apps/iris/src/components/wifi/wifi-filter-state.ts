export type WifiFilterState = {
  speedProfileId: string | null;
  bannedOnly: boolean;
  inactiveOnly: boolean;
  activeOnly: boolean;
  sharedMacsOnly: boolean;
  manualOnly: boolean;
  minDevices: number;
};

export const defaultWifiFilterState: WifiFilterState = {
  activeOnly: false,
  bannedOnly: false,
  inactiveOnly: false,
  manualOnly: false,
  minDevices: 0,
  sharedMacsOnly: false,
  speedProfileId: null,
};
