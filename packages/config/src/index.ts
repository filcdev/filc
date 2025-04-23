import { createLogger } from '@filc/log'
import { createLocalConfig } from './envs/local'
import { createProdConfig } from './envs/prod'
import { createStagingConfig } from './envs/staging'

const logger = createLogger('config')

const getConfig = () => {
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
      return createProdConfig()
    case 'staging':
      return createStagingConfig()
    case 'development':
      return createLocalConfig()
    default: {
      logger.warn(`Unknown environment: ${env}, defaulting to 'development'`)
      return createLocalConfig()
    }
  }
}

export const appConfig = getConfig()
