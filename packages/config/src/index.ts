import { createLogger } from '@filc/log'
import { type FilcConfig, configSchema } from './schema'

const logger = createLogger('config')

const validateConfig = (config: unknown) => {
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    const errorMessage = `Invalid config schema: ${JSON.stringify(
      parsedConfig.error.format(),
      null,
      2
    )}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
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
    throw new Error(`Failed to load config from ${filePath}: ${e}`)
  }
}

const getConfig = async (): Promise<FilcConfig> => {
  logger.debug('Loading config...')

  switch (Bun.env.FILC_ENV) {
    case 'prod':
      return await loadFromFile('/etc/filc/config.json')
    case 'dev':
      return await loadFromFile('../config.json')
    default: {
      logger.warn(
        `Unknown environment: ${Bun.env.FILC_ENV}. Falling back to development config.`
      )
      return await loadFromFile('../config.json')
    }
  }
}

export const appConfig = await getConfig()
