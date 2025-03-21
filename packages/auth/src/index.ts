/**
 * @filc/auth - Custom authentication package for Filc
 *
 * Provides email/password authentication with JWT tokens
 * and session management using Prisma
 */

// Re-export all types
export * from './types'

// Export auth functions
export {
  login,
  register,
  logout,
  validateToken,
  auth,
  refreshAccessToken,
  loginSchema,
  registerSchema,
  refreshTokenSchema
} from './auth'

// Export utility functions
export {
  hashPassword,
  comparePassword,
  createToken,
  createRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeaders,
  SESSION_EXPIRY_DAYS,
  ACCESS_TOKEN_EXPIRY_MINUTES,
  REFRESH_TOKEN_EXPIRY_DAYS
} from './utils'
