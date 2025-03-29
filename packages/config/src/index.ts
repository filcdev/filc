/**
 * @filc/config
 *
 * Central configuration module for the Filc application
 */

import configFile from '../../../filc.config.json' with { type: 'json' }

/**
 * App configuration
 */
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
