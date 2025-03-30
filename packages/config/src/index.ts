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

const exists = (filePath: string) =>
  fs.existsSync(filePath) && fs.statSync(filePath).isFile()

const parse = (filePath: string): Config => {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  try {
    const parsedContent = JSON.parse(fileContent) as Config
    return parsedContent
  } catch (_error) {
    throw new Error(`Error parsing JSON file at ${filePath}`)
  }
}

const loadConfigFile = (): Config => {
  if (process.env.NODE_ENV === 'production') {
    const prodConfigPath = '/opt/filc/filc.config.json'
    if (!exists(prodConfigPath)) {
      throw new Error(`Production config file not found at ${prodConfigPath}`)
    }
    console.log(`⚙️ Loading production config file from ${prodConfigPath}`)
    return {
      ...parse(prodConfigPath),
      isDevelopment: false
    }
  } else {
    const devConfigPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'filc.config.json'
    )
    if (!exists(devConfigPath)) {
      throw new Error(`Development config file not found at ${devConfigPath}`)
    }
    console.log(`⚙️ Loading development config file from ${devConfigPath}`)
    return {
      ...parse(devConfigPath),
      isDevelopment: true
    }
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
  isDevelopment: boolean
}

// Type assertion to ensure the config file matches our expected structure
const config = loadConfigFile()

// Export configuration sections
export const appConfig = config.app
export const backendConfig = config.backend
export const authConfig = config.auth
export const databaseConfig = config.database

// Export default config
export default config
