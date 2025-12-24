import { getLogger } from '@logtape/logtape';

const logger = getLogger(['chronos', 'drizzle']);

const seed = () => {
  logger.info('Seeding database...');
};

seed();
