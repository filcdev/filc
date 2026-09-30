import {
  createCard,
  deleteCard,
  listCards,
  listDoorlockUsers,
  updateCard,
} from '#routes/doorlock/cards';
import {
  createDevice,
  deleteDevice,
  listDevices,
  updateDevice,
} from '#routes/doorlock/devices';
import { exportLogs } from '#routes/doorlock/export';
import { listLogs } from '#routes/doorlock/logs';
import { triggerBulkOta, triggerDeviceOta } from '#routes/doorlock/ota';
import {
  activateVirtualCard,
  listSelfCards,
  updateSelfCardFrozen,
} from '#routes/doorlock/self';
import { deviceStats, doorlockStats } from '#routes/doorlock/stats';

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
