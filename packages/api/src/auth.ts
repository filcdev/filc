import { betterAuth } from 'better-auth'
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from './db'
import { secondaryStorage } from './db/redis'
import { config } from './constants'

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.url,
  secondaryStorage,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 2 * 60
    }
  },
  socialProviders: {
    microsoft: {
      clientId: config.entra.clientId,
      clientSecret: config.entra.clientSecret,
      tenantId: config.entra.tenantId,
    }
  },
  database: 
  drizzleAdapter(db, {
    provider: "pg",
    schema 
  }),
})