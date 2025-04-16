import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, haveIBeenPwned, organization } from 'better-auth/plugins'
import { config } from './constants'
import { authSchema, db } from './db'
import { secondaryStorage } from './db/redis'

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.url,
  secondaryStorage,
  plugin: [admin(), organization(), haveIBeenPwned()],
  socialProviders: {
    microsoft: {
      clientId: config.entra.clientId,
      clientSecret: config.entra.clientSecret,
      tenantId: config.entra.tenantId,
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
})
