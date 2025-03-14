import { z } from 'zod'

import type { Session , Prisma } from '@filc/db'
import { prisma } from '@filc/db'

import type {
  AuthError,
  AuthResult,
  LoginCredentials,
  RegisterCredentials,
} from './types'
import {
  comparePassword,
  createToken,
  getExpiryDate,
  hashPassword,
  verifyToken
} from './utils'

// Schema validations
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8),
  classId: z.string()
})

/**
 * Login with email and password
 */
export async function login(
  credentials: LoginCredentials
): Promise<AuthResult | AuthError> {
  try {
    // Validate credentials
    const result = loginSchema.safeParse(credentials)
    if (!result.success) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Invalid email or password format'
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
      include: {
        roles: {
          select: { id: true, name: true, description: true, color: true }
        }
      }
    })

    if (!user) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Invalid email or password'
      }
    }

    // Verify password
    const passwordValid = await comparePassword(
      credentials.password,
      user.password
    )
    if (!passwordValid) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Invalid email or password'
      }
    }

    // Create session
    const session = await createSession(user.id)

    // Create JWT token
    const token = createToken({
      sub: user.id,
      sessionId: session.id
    })

    // Remove password from user object
    const { password: _, ...safeUser } = user

    return {
      user: safeUser as Prisma.UserGetPayload<{
        include: {
          roles: {
            select: { id: true; name: true; description: true; color: true }
          }
        }
      }>,
      token
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      code: 'auth/unknown',
      message: 'An unexpected error occurred during login'
    }
  }
}

/**
 * Register a new user
 */
export async function register(
  data: RegisterCredentials
): Promise<AuthResult | AuthError> {
  try {
    // Validate registration data
    const result = registerSchema.safeParse(data)
    if (!result.success) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Invalid registration data'
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }]
      }
    })

    if (existingUser) {
      return {
        code: 'auth/user-exists',
        message: 'Email or username already in use'
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        classId: data.classId
      },
      include: {
        roles: {
          select: { id: true, name: true, description: true, color: true }
        }
      }
    })

    // Create session
    const session = await createSession(user.id)

    // Create JWT token
    const token = createToken({
      sub: user.id,
      sessionId: session.id
    })

    // Remove password from user object
    const { password: _, ...safeUser } = user

    return {
      user: safeUser as Prisma.UserGetPayload<{
        include: {
          roles: {
            select: { id: true; name: true; description: true; color: true }
          }
        }
      }>,
      token
    }
  } catch (error) {
    console.error('Registration error:', error)
    return {
      code: 'auth/unknown',
      message: 'An unexpected error occurred during registration'
    }
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<Session> {
  return prisma.session.create({
    data: {
      userId,
      expiresAt: getExpiryDate()
    }
  })
}

/**
 * Validate a token and retrieve user session
 */
export async function validateToken(token: string): Promise<{
  user: Prisma.UserGetPayload<{
    include: {
      roles: {
        select: { id: true; name: true; description: true; color: true }
      }
    }
    select: {
      id: true
      email: true
      username: true
      classId: true
      roles: true
    }
  }>
  session: Session
} | null> {
  try {
    // Verify token
    const payload = verifyToken(token)
    if (!payload) return null

    // Fetch session
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: { include: { roles: true } } }
    })

    // Check if session is valid
    if (
      !session ||
      session.expiresAt < new Date() ||
      session.userId !== payload.sub
    ) {
      return null
    }

    const { password: _, ...safeUser } = session.user

    return {
      user: safeUser as Prisma.UserGetPayload<{
        include: {
          roles: {
            select: { id: true; name: true; description: true; color: true }
          }
        }
        select: {
          id: true
          email: true
          username: true
          classId: true
          roles: true
        }
      }>,
      session
    }
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

/**
 * Logout user by invalidating session
 */
export async function logout(sessionId: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { id: sessionId } })
    return true
  } catch (error) {
    console.error('Logout error:', error)
    return false
  }
}

/**
 * Get current session from cookie (for server-side usage)
 */
export async function auth(): Promise<{
  user: Prisma.UserGetPayload<{
    include: {
      roles: {
        select: { id: true; name: true; description: true; color: true }
      }
    }
    select: {
      id: true
      email: true
      username: true
      classId: true
      roles: true
    }
  }>
  session: Session
} | null> {
  // This is a placeholder for server-side auth with cookies
  // In a real implementation, this would extract the token from cookies
  // and validate it using validateToken


  // shut eslint up
  await new Promise((resolve) => resolve(null))

  // For now, returns null to indicate no session
  return null
}
