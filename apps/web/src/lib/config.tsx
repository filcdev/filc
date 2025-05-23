import { Loader } from '@/components/loader'
import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

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

const CONFIG_CACHE_KEY = 'filc_config_cache'

const ConfigContext = createContext<AppConfig | undefined>(undefined)

export const useConfig = () => {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return ctx
}

const isConfigEqual = (a: AppConfig, b: AppConfig) => {
  return JSON.stringify(a) === JSON.stringify(b)
}

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<AppConfig | null>(() => {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY)
    return cached ? (JSON.parse(cached) as AppConfig) : null
  })
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(
        import.meta.env.MODE === 'development'
          ? 'http://localhost:3000/config'
          : 'https://api.filc.space/config'
      )
      if (!res.ok) {
        throw new Error('Failed to fetch config')
      }
      const freshConfig: AppConfig = await res.json()
      const cached = localStorage.getItem(CONFIG_CACHE_KEY)
      const cachedConfig = cached ? (JSON.parse(cached) as AppConfig) : null
      if (!(cachedConfig && isConfigEqual(freshConfig, cachedConfig))) {
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(freshConfig))
        setConfig(freshConfig)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  if (error) {
    return <div>Failed to load config: {error}</div>
  }
  if (!config) {
    return <Loader />
  }
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  )
}
