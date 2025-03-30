/**
 * @filc/config
 *
 * Central configuration module for the Filc application
 */
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let configFile = {} as unknown

if (process.env.NODE_ENV === 'production') {
  if (!fs.existsSync('/opt/filc/filc.config.json')) {
    throw new Error(
      'Configuration file not found. Mount your filc.config.json file to /opt/filc/filc.config.json'
    )
  }
  configFile = fs.readFileSync('/opt/filc/filc.config.json', 'utf-8')
} else {
  const configPath = path.join(__dirname, '..', '..', '..', 'filc.config.json')
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8')
    try {
      configFile = JSON.parse(content)
    } catch (_) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      throw new Error(
        'Error parsing configuration file. Please ensure it is valid JSON.'
      )
    }
  } else {
    throw new Error(
      'Configuration file not found. Please create a config.json file in the root directory.'
    )
  }
}

export interface AppConfig {
  name: string
  version: string
}

/**
 * Backend server configuration
 */
export interface BackendConfig {
  url: string
  port: number
}

/**
 * Authentication token configuration
 */
export interface TokenConfig {
  accessToken: {
    expiryInMinutes: number
    secret: string
  }
  refreshToken: {
    expiryInDays: number
    secret: string
  }
}

/**
 * Session configuration
 */
export interface SessionConfig {
  expiryInDays: number
}

/**
 * Email verification configuration
 */
export interface VerificationConfig {
  tokenExpiryInHours: number
}

/**
 * Password requirements configuration
 */
export interface PasswordConfig {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecial: boolean
}

/**
 * Username requirements configuration
 */
export interface UsernameConfig {
  minLength: number
  maxLength: number
  pattern: string
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  tokens: TokenConfig
  session: SessionConfig
  verification: VerificationConfig
  passwords: PasswordConfig
  username: UsernameConfig
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  url: string
}

/**
 * Complete application configuration
 */
export interface Config {
  app: AppConfig
  backend: BackendConfig
  auth: AuthConfig
  database: DatabaseConfig
}

// Type assertion to ensure the config file matches our expected structure
const config = configFile as Config

// Export configuration sections
export const appConfig = config.app
export const backendConfig = config.backend
export const authConfig = config.auth
export const databaseConfig = config.database

// Export default config
export default config
