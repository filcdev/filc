import { createLocalConfig } from './envs/local'
import { createProdConfig } from './envs/prod'
import { createStagingConfig } from './envs/staging'

const getConfig = () => {
  switch (process.env.APP_ENV) {
    case 'production':
      return createProdConfig()
    case 'staging':
      return createStagingConfig()
    case 'local':
      return createLocalConfig()
    default:
      throw new Error(`Invalid APP_ENV "${process.env.APP_ENV}". If you are running locally, please set APP_ENV=local, like so: "APP_ENV=local bun dev"`)
  }
}

export const appConfig = getConfig()
