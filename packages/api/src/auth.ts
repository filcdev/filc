import { betterAuth } from 'better-auth'
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db }, schema from './db'
import { config } from './constants'

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.url,
  database: 
    drizzleAdapter(db, {
      provider: "pg",
      schema 
    }),
  socialProviders: {
    microsoft: {
      clientId: config.entra.clientId,
      clientSecret: config.entra.clientSecret,
      tenantId: config.entra.tenantId,
    }
  }
})