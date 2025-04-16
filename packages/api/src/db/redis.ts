import { RedisClient } from "bun";
import { config } from "../constants";

const c = config.redis

const redisUrl = `redis://${c.user}:${c.password}@${c.host}:${c.port}`

export const redisClient = new RedisClient(redisUrl)

export const secondaryStorage = {
  delete: async (key: string) => {
    await redisClient.del(key)
  },
  get: async (key: string) => {
    return await redisClient.get(key)
  },
  set: async (key: string, value: string) => {
    await redisClient.set(key, value)
  }
}