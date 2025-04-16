import { RedisClient } from 'bun'
import { config } from '../constants'

const c = config.redis

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
      console.error('Error deleting key from Redis:', e)
    }
  },
  get: async (key: string) => {
    try {
      return await redisClient.get(key)
    } catch (e) {
      console.error('Error getting key from Redis:', e)
      return null
    }
  },
  set: async (key: string, value: string) => {
    try {
      await redisClient.set(key, value)
    } catch (e) {
      console.error('Error setting key in Redis:', e)
    }
  },
}
