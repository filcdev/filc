import { pino } from 'pino'

const rootLogger = pino({
  name: 'filc',
})

export const createLogger = (name: string) => {
  return rootLogger.child({ name })
}
