import { pino } from 'pino'

const rootLogger = pino({
  name: 'filc',
  level: 'debug',
})

export const createLogger = (name: string) => {
  return rootLogger.child({ name })
}
