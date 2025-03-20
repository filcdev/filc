import { compare, hash } from '@node-rs/bcrypt'
import { sign, verify } from '@node-rs/jsonwebtoken'

import type { TokenPayload } from './types'

export const SESSION_EXPIRY_DAYS = 30
const JWT_SECRET = process.env.JWT_SECRET ?? 'supersecret'

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
 * Create a JWT token
 */
export async function createToken(
  payload: TokenPayload['data']
): Promise<string> {
  return await sign(
    {
      data: payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_DAYS * 24 * 60 * 60
    },
    JWT_SECRET
  )
}

/**
 * Verify a JWT token
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
 * Calculate future expiration date for sessions
 */
export function getExpiryDate(): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + SESSION_EXPIRY_DAYS)
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
