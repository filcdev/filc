export type FilcConfig = {
  env: string
  auth: {
    secret: string
    url: string
  }
  entra: {
    clientId: string
    clientSecret: string
    tenantId: string
  }
  postgres: {
    host: string
    port: number
    database: string
    user: string
    password: string
  }
  redis: {
    host: string
    port: number
    user: string
    password: string
  }
  frontend: {
    url: string
    dsn?: string
  }
}
