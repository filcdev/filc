import { appConfig } from '@filc/config'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, haveIBeenPwned, organization } from 'better-auth/plugins'
import { authSchema, db } from './db'
import { secondaryStorage } from './db/redis'

export const auth = betterAuth({
  secret: appConfig.auth.secret,
  baseURL: appConfig.auth.url,
  secondaryStorage,
  trustedOrigins: [appConfig.auth.url, 'http://localhost:4000'],
  plugin: [admin(), organization(), haveIBeenPwned()],
  socialProviders: {
    microsoft: {
      clientId: appConfig.entra.clientId,
      clientSecret: appConfig.entra.clientSecret,
      tenantId: appConfig.entra.tenantId,
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
})
