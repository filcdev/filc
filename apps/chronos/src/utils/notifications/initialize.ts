import { getLogger } from '@logtape/logtape';
import { modules } from '#modules';
import { registerHandler } from '#utils/notifications/engine';
import { initializeFcm } from '#utils/notifications/providers/fcm';

const logger = getLogger(['chronos', 'notifications', 'initialize']);

/**
 * Register every module's notification handlers, then the delivery channels.
 *
 * What a notification says, who receives it and which preference gates it all
 * live with the module that raises it; this only wires the handlers the
 * modules declared into the engine.
 */
export function initializeNotificationEngine(): void {
  logger.info('Initializing notification engine');

  let count = 0;
  for (const module of modules) {
    for (const handler of module.notifications ?? []) {
      registerHandler(handler);
      count += 1;
    }
  }

  initializeFcm();

  logger.info(`Notification engine initialized with ${count} handlers`);
}
