import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { db } from '.'

migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations completed successfully.')
