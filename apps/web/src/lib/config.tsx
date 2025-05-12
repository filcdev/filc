import type React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

export type AppConfig = {
  env: string
  app: {
    name: string
    version: string
  }
  frontend: {
    url: string
    apiUrl: string
    dsn: string | null
  }
}

const ConfigContext = createContext<AppConfig | undefined>(undefined)

export const useConfig = () => {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return ctx
}

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(
      import.meta.env.MODE === 'development'
        ? 'http://localhost:3000/config'
        : 'https://api.filc.space/config'
    )
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch config')
        }
        return res.json()
      })
      .then(setConfig)
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return <div>Failed to load config: {error}</div>
  }
  if (!config) {
    return <div>Loading configuration...</div>
  }
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  )
}
