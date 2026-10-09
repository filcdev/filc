import {
  createWifiDevice,
  createWifiNas,
  createWifiRoleProfile,
  createWifiSpeedProfile,
  createWifiUser,
  deleteWifiDevice,
  deleteWifiNas,
  deleteWifiRoleProfile,
  deleteWifiSpeedProfile,
  deleteWifiUser,
  listWifiAuthLogs,
  listWifiDevices,
  listWifiNas,
  listWifiRoleProfiles,
  listWifiSpeedProfiles,
  listWifiUsers,
  updateWifiDevice,
  updateWifiNas,
  updateWifiRoleProfile,
  updateWifiSpeedProfile,
  updateWifiUser,
} from '#modules/wifi/admin';
import { authorizeRadiusHandler } from '#modules/wifi/radius';
import {
  createSelfWifi,
  getSelfWifi,
  getSelfWifiCertificate,
  updateSelfWifiDevice,
  updateSelfWifiPassword,
} from '#modules/wifi/self';
import { wifiStats } from '#modules/wifi/stats';
import { wifiStatus } from '#modules/wifi/status';

export const wifiRouter = {
  authLogs: { list: listWifiAuthLogs },
  devices: {
    create: createWifiDevice,
    delete: deleteWifiDevice,
    list: listWifiDevices,
    update: updateWifiDevice,
  },
  nas: {
    create: createWifiNas,
    delete: deleteWifiNas,
    list: listWifiNas,
    update: updateWifiNas,
  },
  radius: { authorize: authorizeRadiusHandler },
  roleSpeedProfiles: {
    create: createWifiRoleProfile,
    delete: deleteWifiRoleProfile,
    list: listWifiRoleProfiles,
    update: updateWifiRoleProfile,
  },
  self: {
    certificate: getSelfWifiCertificate,
    changePassword: updateSelfWifiPassword,
    create: createSelfWifi,
    get: getSelfWifi,
    updateDevice: updateSelfWifiDevice,
  },
  speedProfiles: {
    create: createWifiSpeedProfile,
    delete: deleteWifiSpeedProfile,
    list: listWifiSpeedProfiles,
    update: updateWifiSpeedProfile,
  },
  stats: { overview: wifiStats },
  status: wifiStatus,
  users: {
    create: createWifiUser,
    delete: deleteWifiUser,
    list: listWifiUsers,
    update: updateWifiUser,
  },
};
