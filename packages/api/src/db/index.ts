import { appConfig } from '@filc/config'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
export * from './schema'

const c = appConfig.postgres
const databaseUrl = `postgresql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}`
const client = new SQL(databaseUrl)

export const db = drizzle({ client })
