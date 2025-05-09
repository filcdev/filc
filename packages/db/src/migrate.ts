import { db } from '@/index'
import { createLogger } from '@filc/log'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

const logger = createLogger('migrate')

migrate(db, { migrationsFolder: './drizzle' })
  .then(() => {
    logger.info('Migrations completed successfully')
  })
  .catch(err => {
    logger.fatal('Migrations failed', err)
  })
