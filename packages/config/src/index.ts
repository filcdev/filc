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

const exists = (filePath: string) => fs.existsSync(filePath) && fs.statSync(filePath).isFile()

const parse = (filePath: string) => {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  try {
    return JSON.parse(fileContent)
  } catch (_error) {
    throw new Error(`Error parsing JSON file at ${filePath}`)
  }
}

const loadConfigFile = () => {
  if (process.env.NODE_ENV === 'production') {
    const prodConfigPath = '/opt/filc/filc.config.json'
    if (!exists(prodConfigPath)) {
      throw new Error(`Production config file not found at ${prodConfigPath}`)
    }
    return parse(prodConfigPath)
  } else {
    const devConfigPath = path.join(__dirname, '..', '..', '..', 'filc.config.json')
    if (!exists(devConfigPath)) {
      throw new Error(`Development config file not found at ${devConfigPath}`)
    }
    return parse(devConfigPath)
  }
}

const configFile = loadConfigFile()

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
