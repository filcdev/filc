import { getLogger } from '@logtape/logtape';
import Baker from 'cronbake';
import { cleanUpOldDeviceAuditLogs } from '#utils/cards';

const logger = getLogger(['chronos', 'cron']);

export const baker = Baker.create({
  autoStart: false,
  logger,
  onError(error, jobName) {
    logger.error(`Error in job ${jobName}: ${error.message}`);
  },
});

baker.add({
  callback: cleanUpOldDeviceAuditLogs,
  cron: '0 0 0 ? * SUN *', // Runs every Sunday at midnight
  name: 'clean-up-old-card-audit-logs',
});
