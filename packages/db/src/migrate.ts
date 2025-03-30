import { exec } from 'child_process'
// resolve our schema to ../prisma/schema/schema.prisma
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

import config, { databaseConfig } from '@filc/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const schemaPath = resolve(__dirname, '../prisma/schema')

const execPromise = promisify(exec)
const shouldRunMigrations = !config.isDevelopment

export const migrate = async () => {
  if (!shouldRunMigrations) {
    console.log('🚧 Skipping migrations in test/development environment')
    return
  }

  console.log('🚀 Running migrations...')
  const { stderr } = await execPromise(
    `pnpm prisma db push --schema=${schemaPath}`,
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseConfig.url
      }
    }
  )
  if (stderr) {
    console.error(`❌ Error running migrations: ${stderr}`)
    throw new Error(`Migration failed: ${stderr}`)
  }
  console.log('✅ Migrations completed successfully')
}
