import { getLogger } from '@logtape/logtape';
import Baker from 'cronbake';
import { cleanUpOldDeviceAuditLogs } from '#utils/doorlock/cards';
import { cleanUpOldNotifications } from '#utils/notifications/cleanup';

const logger = getLogger(['chronos', 'cron']);

export const baker = Baker.create({
  autoStart: false,
  logger,
  onError(error, jobName) {
    logger.error(`Error in job ${jobName}: ${error.message}`, { error });
  },
});

export const setupCronJobs = () => {
  baker.add({
    callback: cleanUpOldDeviceAuditLogs,
    cron: '@monthly',
    name: 'clean-up-old-card-audit-logs',
  });

  baker.add({
    callback: cleanUpOldNotifications,
    cron: '@daily',
    name: 'clean-up-old-notifications',
  });

  const jobs = baker.getJobNames();

  logger.info(`Configured ${jobs.length} cron jobs`);
  logger.trace('Configured cron jobs:', { jobs });

  baker.bakeAll();
};
