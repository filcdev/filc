import { createLogger } from '@filc/log'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import path from 'path'
import { db } from '.'
import { appConfig } from '@filc/config'

const logger = createLogger('migrate')

export const run = () => {
  migrate(db, { migrationsFolder: appConfig.env === 'production' ? './drizzle' : path.join(__dirname, '../drizzle') })
    .then(() => {
      logger.info('Migrations completed successfully')
    })
    .catch(err => {
      logger.fatal(`Migrations failed: ${err}`)
      process.exit(1)
    })
}

if (require.main === module) {
  run()
}
