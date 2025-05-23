import { appConfig } from '@filc/config'
import { db } from '@filc/db'
import { secondaryStorage } from '@filc/db/redis'
import { authSchema } from '@filc/db/schema/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization } from 'better-auth/plugins'
import {
  ac,
  admin as admin_role,
  editor,
  root,
  student,
  teacher,
} from './permissions'

export const auth = betterAuth({
  secret: appConfig.auth.secret,
  baseURL: appConfig.auth.url,
  basePath: '/auth',
  secondaryStorage,
  trustedOrigins: [
    appConfig.auth.url,
    appConfig.frontend.url,
    'http://localhost:4000',
  ],
  socialProviders: {
    microsoft: {
      clientId: appConfig.entra.clientId,
      clientSecret: appConfig.entra.clientSecret,
      tenantId: appConfig.entra.tenantId,
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
    debugLogs: appConfig.env === 'development',
  }),
  plugins: [
    admin({
      adminRoles: ['root'],
      roles: {
        root,
        admin_role,
        editor,
        teacher,
        student,
      },
    }),
    organization({
      ac,
      roles: {
        root,
        admin_role,
        editor,
        teacher,
        student,
      },
    }),
  ],
})
