import { getLogger } from '@logtape/logtape';
import Baker from 'cronbake';
import { modules } from '#modules';

const logger = getLogger(['chronos', 'cron']);

export const baker = Baker.create({
  autoStart: false,
  logger,
  onError(error, jobName) {
    logger.error(`Error in job ${jobName}: ${error.message}`, { error });
  },
});

/**
 * Register every module's scheduled work. A job lives in the module that owns
 * the thing it maintains, so this is the only file that has to know a module
 * exists.
 */
export const setupCronJobs = () => {
  for (const module of modules) {
    for (const job of module.jobs ?? []) {
      baker.add(job);
    }
  }

  const jobs = baker.getJobNames();

  logger.info(`Configured ${jobs.length} cron jobs`);
  logger.trace('Configured cron jobs:', { jobs });

  baker.bakeAll();
};
