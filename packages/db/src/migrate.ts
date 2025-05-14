// biome-ignore lint/correctness/noNodejsModules: this will not see the light of a browser
import path from 'node:path'
import { appConfig } from '@filc/config'
import { createLogger } from '@filc/log'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { db } from '.'

const logger = createLogger('migrate')

export const run = () => {
  migrate(db, {
    migrationsFolder:
      appConfig.env === 'production'
        ? './drizzle'
        : path.join(__dirname, '../drizzle'),
  })
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
