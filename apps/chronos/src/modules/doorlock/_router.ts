import {
  createCard,
  deleteCard,
  listCards,
  listDoorlockUsers,
  updateCard,
} from '#modules/doorlock/cards';
import {
  createDevice,
  deleteDevice,
  listDevices,
  updateDevice,
} from '#modules/doorlock/devices';
import { exportLogs } from '#modules/doorlock/export';
import { listLogs } from '#modules/doorlock/logs';
import { triggerBulkOta, triggerDeviceOta } from '#modules/doorlock/ota';
import {
  activateVirtualCard,
  listSelfCards,
  updateSelfCardFrozen,
} from '#modules/doorlock/self';
import { deviceStats, doorlockStats } from '#modules/doorlock/stats';

export const doorlockRouter = {
  cards: {
    create: createCard,
    delete: deleteCard,
    list: listCards,
    update: updateCard,
    users: listDoorlockUsers,
  },
  devices: {
    create: createDevice,
    delete: deleteDevice,
    list: listDevices,
    stats: deviceStats,
    triggerOta: triggerDeviceOta,
    update: updateDevice,
    updateAll: triggerBulkOta,
  },
  logs: {
    export: exportLogs,
    list: listLogs,
  },
  self: {
    cards: {
      activate: activateVirtualCard,
      list: listSelfCards,
      setFrozen: updateSelfCardFrozen,
    },
  },
  stats: {
    overview: doorlockStats,
  },
};
