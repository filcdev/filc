import { createLogger } from '@filc/log'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { db } from '.'

const logger = createLogger('migrate')

export const run = () => {
  migrate(db, { migrationsFolder: './drizzle' })
  .then(() => {
    logger.info('Migrations completed successfully')
  })
  .catch(err => {
    logger.fatal('Migrations failed', err)
  })
}

if (require.main === module) {
  run()
}
