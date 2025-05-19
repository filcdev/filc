import { defineConfig } from 'drizzle-kit'
import config from '../config/config.json' assert { type: 'json' }

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema',
  out: './drizzle',
  dbCredentials: config.postgres
})
