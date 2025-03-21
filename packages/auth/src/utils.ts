import { compare, hash } from '@node-rs/bcrypt'
import { sign, verify } from '@node-rs/jsonwebtoken'
import { randomBytes } from 'crypto'

import type { RefreshTokenPayload, TokenPayload } from './types'

export const SESSION_EXPIRY_DAYS = 30
export const ACCESS_TOKEN_EXPIRY_MINUTES = 15 // Access token expires in 15 minutes
export const REFRESH_TOKEN_EXPIRY_DAYS = 30 // Refresh token expires in 30 days
const JWT_SECRET = process.env.JWT_SECRET ?? 'supersecret'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET ?? 'refresh-supersecret'

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
 * Create a JWT access token
 */
export async function createToken(
  payload: TokenPayload['data']
): Promise<string> {
  return await sign(
    {
      data: payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY_MINUTES * 60
    },
    JWT_SECRET
  )
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
      exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60
    },
    REFRESH_TOKEN_SECRET
  )
}

/**
 * Verify a JWT access token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    return (await verify(token, JWT_SECRET)) as TokenPayload
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

/**
 * Verify a JWT refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    return (await verify(token, REFRESH_TOKEN_SECRET)) as RefreshTokenPayload
  } catch (error) {
    console.error('Refresh token verification error:', error)
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
 * Extract authorization token from request headers
 */
export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7) // Remove 'Bearer ' prefix
}
