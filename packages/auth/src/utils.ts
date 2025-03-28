import { randomBytes } from 'crypto'
import { compare, hash } from '@node-rs/bcrypt'
import { sign, verify } from '@node-rs/jsonwebtoken'

import { authConfig } from '@filc/config'

import type { RefreshTokenPayload, TokenPayload } from './types'

// Constants from config
export const SESSION_EXPIRY_DAYS = authConfig.session.expiryInDays
export const ACCESS_TOKEN_EXPIRY_MINUTES =
  authConfig.tokens.accessToken.expiryInMinutes
export const REFRESH_TOKEN_EXPIRY_DAYS =
  authConfig.tokens.refreshToken.expiryInDays
export const VERIFICATION_TOKEN_EXPIRY_HOURS =
  authConfig.verification.tokenExpiryInHours

// Get secrets from config or environment
const JWT_SECRET =
  authConfig.tokens.accessToken.secret || process.env.JWT_SECRET
const REFRESH_TOKEN_SECRET =
  authConfig.tokens.refreshToken.secret || process.env.REFRESH_TOKEN_SECRET

// Ensure we have proper JWT secrets
if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET and REFRESH_TOKEN_SECRET must be set in production'
    )
  }
  console.warn(
    'Warning: JWT_SECRET and/or REFRESH_TOKEN_SECRET environment variables not set. ' +
      'Using insecure default secrets - DO NOT USE IN PRODUCTION!'
  )
}

// Use config values with fallbacks
const finalJwtSecret = JWT_SECRET ?? 'dev_jwt_secret_do_not_use_in_production'
const finalRefreshSecret =
  REFRESH_TOKEN_SECRET ?? 'dev_refresh_secret_do_not_use_in_production'

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword)
}

/**
 * Create a JWT access token with a JWT ID to allow token validation
 */
export async function createToken(
  payload: TokenPayload['data']
): Promise<{ token: string; jwtId: string }> {
  const jwtId = generateSecureToken(16) // Generate a shorter ID for JWT

  const token = await sign(
    {
      data: { ...payload, jwtId },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY_MINUTES * 60
    },
    finalJwtSecret
  )

  return { token, jwtId }
}

/**
 * Create a JWT refresh token
 */
export async function createRefreshToken(
  payload: RefreshTokenPayload['data']
): Promise<string> {
  return await sign(
    {
      data: payload,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60
    },
    finalRefreshSecret
  )
}

/**
 * Verify a JWT access token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    return (await verify(token, finalJwtSecret)) as TokenPayload
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Token verification error:', error)
    }
    return null
  }
}

/**
 * Verify a JWT refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload | null> {
  try {
    return (await verify(token, finalRefreshSecret)) as RefreshTokenPayload
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Refresh token verification error:', error)
    }
    return null
  }
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 64): string {
  return randomBytes(length).toString('hex')
}

/**
 * Calculate future expiration date for sessions
 */
export function getExpiryDate(): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + SESSION_EXPIRY_DAYS)
  return expiryDate
}

/**
 * Calculate future expiration date for refresh tokens
 */
export function getRefreshTokenExpiryDate(): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  return expiryDate
}

/**
 * Update session with new JWT ID and last activity timestamp
 */
export async function updateSessionJwtId(sessionId: string, jwtId: string) {
  const { prisma } = await import('@filc/db')
  return await prisma.session.update({
    where: { id: sessionId },
    data: {
      activeJwtId: jwtId,
      lastActivity: new Date()
    }
  })
}

/**
 * Extract authorization token from request headers
 */
export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7) // Remove 'Bearer ' prefix
}

/**
 * Generate a random verification token
 * @returns Random token string
 */
export function generateVerificationToken(): string {
  return generateSecureToken(32)
}

/**
 * Get expiry date for verification token
 * @returns Date object with expiry timestamp
 */
export function getVerificationExpiry(): Date {
  const expiryDate = new Date()
  expiryDate.setHours(expiryDate.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS)
  return expiryDate
}

/**
 * Check if a verification token is expired
 * @param expires Expiration date
 * @returns Boolean indicating if the token is expired
 */
export function isVerificationExpired(expires: Date): boolean {
  return new Date() > expires
}
