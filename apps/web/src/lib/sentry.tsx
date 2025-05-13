import { init as sentryInit } from '@sentry/browser'
import { useConfig } from './config'

export const Sentry = () => {
  const config = useConfig()

  if (!config.frontend.dsn) {
    return null
  }

  sentryInit({
    dsn: config.frontend.dsn,
  })

  return null
}
