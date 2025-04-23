import { appConfig } from '@filc/config'
import { pino } from 'pino'

const rootLogger = pino({
  name: appConfig.app.name,
})

export const createLogger = (name: string) => {
  return rootLogger.child({ name })
}
