import { appConfig } from '@filc/config'
import { createLogger } from '@filc/log'
import { RedisClient } from 'bun'

const c = appConfig.redis
const logger = createLogger('redis')

const redisUrl = `redis://${c.user}:${c.password}@${c.host}:${c.port}`

export const redisClient = new RedisClient(redisUrl, {
  autoReconnect: true,
  enableOfflineQueue: true,
  connectionTimeout: 5000,
  idleTimeout: 0,
})

export const secondaryStorage = {
  delete: async (key: string) => {
    try {
      await redisClient.del(key)
    } catch (e) {
      logger.error('Error deleting key from Redis:', e)
    }
  },
  get: async (key: string) => {
    try {
      return await redisClient.get(key)
    } catch (e) {
      logger.error('Error getting key from Redis:', e)
      return null
    }
  },
  set: async (key: string, value: string) => {
    try {
      await redisClient.set(key, value)
    } catch (e) {
      logger.error('Error setting key in Redis:', e)
    }
  },
}
