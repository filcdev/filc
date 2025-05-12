import { createLogger } from '@filc/log'
import { type FilcConfig, configSchema } from './schema'

const logger = createLogger('config')

const validateConfig = (config: unknown) => {
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    logger.error('Invalid config schema', parsedConfig.error.format())
    throw new Error('Invalid config schema')
  }
  logger.debug('Config schema is valid')
}

const loadFromFile = async (filePath: string) => {
  try {
    const config = await import(`${filePath}`)
    logger.info(`Loaded config from ${filePath}`)
    validateConfig(config)
    return config
  } catch (e) {
    logger.error(`Failed to load config from ${filePath}`, e)
    throw new Error(`Failed to load config from ${filePath}`)
  }
}

const getConfig = async (): Promise<FilcConfig> => {
  logger.debug('Loading config...')
  let env: string | undefined
  try {
    env = process.env.NODE_ENV
    if (!env) {
      process && logger.warn("NODE_ENV is not set, defaulting to 'development'")
      env = 'development'
    }
  } catch (_e) {
    env = import.meta.env.MODE
  }

  switch (env) {
    case 'production':
      return await loadFromFile('/etc/filc/config.json')
    case 'development':
      return await loadFromFile('../config.json')
    default: {
      logger.warn(
        `Unknown environment: ${env}. Falling back to development config.`
      )
      return await loadFromFile('../config.json')
    }
  }
}

export const appConfig = await getConfig()
