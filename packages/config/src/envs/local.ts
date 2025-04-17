import { defineConfig } from '../defineConfig'

export const createLocalConfig = () => {
  return defineConfig({
    env: 'local',
    auth: {
      secret: 'bD1gfhJZjzHbhCOCPMaPfTLAq2JM9LPF',
      url: 'http://localhost:3000',
    },
    entra: {
      clientId: '',
      clientSecret: '',
      tenantId: '',
    },
    postgres: {
      host: 'localhost',
      port: 5432,
      database: 'filc',
      user: 'filc',
      password: 'f1lcp4ss',
    },
    redis: {
      host: 'localhost',
      port: 6379,
      user: 'default',
      password: 'f1lcp4ss',
    },
    frontend: {
      url: 'http://localhost:4000',
    },
  })
}
