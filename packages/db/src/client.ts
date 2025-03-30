import { databaseConfig } from '@filc/config'

import { PrismaClient } from '../generated/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Create PrismaClient with configuration from central config file
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseConfig.url
      }
    }
  })

// Save prisma client to global in development to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
