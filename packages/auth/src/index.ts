import {
  ac,
  root,
  admin as admin_role,
  editor,
  teacher,
  student,
} from "@/permissions";
import { appConfig } from "@filc/config";
import { db } from "@filc/db";
import { secondaryStorage } from "@filc/db/redis";
import { authSchema } from "@filc/db/schema/auth.ts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";

export const auth = betterAuth({
  secret: appConfig.auth.secret,
  baseURL: appConfig.auth.url,
  secondaryStorage,
  trustedOrigins: [appConfig.auth.url, "http://localhost:4000"],
  socialProviders: {
    microsoft: {
      clientId: appConfig.entra.clientId,
      clientSecret: appConfig.entra.clientSecret,
      tenantId: appConfig.entra.tenantId,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  plugin: [
    admin(),
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
});
