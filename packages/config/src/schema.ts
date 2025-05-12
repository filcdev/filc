import { z } from 'zod'

export const configSchema = z.object({
  env: z.string(),
  app: z.object({
    name: z.string(),
    version: z.string(),
  }),
  auth: z.object({
    secret: z.string(),
    url: z.string().url(),
  }),
  entra: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    tenantId: z.string(),
  }),
  postgres: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    database: z.string(),
    user: z.string(),
    password: z.string(),
  }),
  redis: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    user: z.string(),
    password: z.string(),
  }),
  frontend: z.object({
    url: z.string().url(),
    dsn: z.string().optional(),
  }),
})

export type FilcConfig = z.infer<typeof configSchema>
