import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { config } from '../constants'
export { schema } from './schema'

const c = config.postgres
const databaseUrl = `postgresql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}`
const client = new SQL(databaseUrl)

export const db = drizzle({ client })
