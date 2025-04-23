import { createLocalConfig } from './envs/local'
import { createProdConfig } from './envs/prod'
import { createStagingConfig } from './envs/staging'

const getConfig = () => {
  let env: string | undefined
  try {
    env = process.env.NODE_ENV
    if (!env) {
      process &&
        console.warn("NODE_ENV is not set, defaulting to 'development'")
      env = 'development'
    }
  } catch (e) {
    env = import.meta.env.MODE
  }

  switch (env) {
    case 'production':
      return createProdConfig()
    case 'staging':
      return createStagingConfig()
    case 'development':
      return createLocalConfig()
    default:
      throw new Error(
        `Invalid APP_ENV "${env}". If you are running locally, please set APP_ENV=local, like so: "APP_ENV=local bun dev"`
      )
  }
}

export const appConfig = getConfig()
