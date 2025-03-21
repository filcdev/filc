import { z } from 'zod'

import type { Prisma, Session } from '@filc/db'
import { prisma, PrismaClientKnownRequestError, PrismaClientValidationError } from '@filc/db'
import { hasAnyPermission, hasPermission } from '@filc/rbac'

import type {
  AuthError,
  AuthorizeOptions,
  AuthResult,
  LoginCredentials,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterCredentials
} from './types'
import {
  comparePassword,
  createRefreshToken,
  createToken,
  generateSecureToken,
  getExpiryDate,
  getRefreshTokenExpiryDate,
  hashPassword,
  verifyRefreshToken,
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
  classId: z.string(),
  roles: z.array(z.string()).optional()
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
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
          include: {
            permissions: {
              select: { id: true, name: true }
            }
          }
        },
        permissionOverrides: {
          include: {
            permission: true
          }
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

    // Create tokens
    const { token, refreshToken } = await createTokenPair(user.id, session.id)

    // Remove password from user object
    const { password: _, ...safeUser } = user
    return {
      user: safeUser,
      token,
      refreshToken
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

    // Create user with roles
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        classId: data.classId,
        ...(data.roles && {
          roles: {
            connect: data.roles.map((roleId) => ({ id: roleId }))
          }
        })
      },
      include: {
        roles: {
          include: {
            permissions: {
              select: { id: true, name: true }
            }
          }
        },
        permissionOverrides: {
          include: {
            permission: true
          }
        }
      }
    })

    // Create session
    const session = await createSession(user.id)

    // Create tokens
    const { token, refreshToken } = await createTokenPair(user.id, session.id)

    // Remove password from user object
    const { password: _, ...safeUser } = user
    return {
      user: safeUser,
      token,
      refreshToken
    }
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          code: 'auth/user-exists',
          message: 'Email or username already in use'
        }
      }
      if (error.code === 'P2003') {
        return {
          code: 'auth/invalid-class',
          message: 'Invalid class ID'
        }
      }
    }
    if (error instanceof PrismaClientValidationError) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Invalid registration data'
      }
    }

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
 * Create a token pair (access and refresh tokens)
 */
export async function createTokenPair(
  userId: string,
  sessionId: string
): Promise<{ token: string; refreshToken: string }> {
  // Generate a random token ID for the refresh token
  const tokenId = generateSecureToken(24)

  // Create access token
  const token = await createToken({
    sub: userId,
    sessionId
  })

  // Create refresh token
  const refreshTokenJWT = await createRefreshToken({
    sub: userId,
    sessionId,
    tokenId
  })

  // Store refresh token in the database
  await prisma.refreshToken.create({
    data: {
      token: tokenId,
      userId,
      sessionId,
      expiresAt: getRefreshTokenExpiryDate()
    }
  })

  return {
    token,
    refreshToken: refreshTokenJWT
  }
}

/**
 * Refresh access token using a refresh token
 */
export async function refreshAccessToken(
  refreshTokenRequest: RefreshTokenRequest
): Promise<RefreshTokenResponse | AuthError> {
  try {
    // Validate refresh token
    const result = refreshTokenSchema.safeParse(refreshTokenRequest)
    if (!result.success) {
      return {
        code: 'auth/invalid-token',
        message: 'Invalid refresh token format'
      }
    }

    // Verify the refresh token JWT
    const payload = await verifyRefreshToken(refreshTokenRequest.refreshToken)
    if (!payload) {
      return {
        code: 'auth/invalid-token',
        message: 'Invalid refresh token'
      }
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: payload.data.tokenId,
        userId: payload.data.sub,
        sessionId: payload.data.sessionId,
        isRevoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    })

    if (!storedToken) {
      return {
        code: 'auth/invalid-token',
        message: 'Refresh token not found or expired'
      }
    }

    // Revoke the old refresh token for security
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true }
    })

    // Create a new token pair
    const { token, refreshToken } = await createTokenPair(
      payload.data.sub,
      payload.data.sessionId
    )

    return { token, refreshToken }
  } catch (error) {
    console.error('Token refresh error:', error)
    return {
      code: 'auth/unknown',
      message: 'An unexpected error occurred during token refresh'
    }
  }
}

/**
 * Validate a token and retrieve user session
 */
export async function validateToken(token: string): Promise<{
  user: Prisma.UserGetPayload<{
    include: {
      roles: {
        include: {
          permissions: {
            select: { id: true; name: true }
          }
        }
      }
      permissionOverrides: {
        include: {
          permission: true
        }
      }
    }
    omit: {
      password: true
    }
  }>
  session: Session
} | null> {
  try {
    const payload = await verifyToken(token)
    if (!payload) return null

    // Fetch session
    const session = await prisma.session.findUnique({
      where: { id: payload.data.sessionId },
      include: {
        user: {
          include: {
            roles: {
              include: {
                permissions: {
                  select: { id: true, name: true }
                }
              }
            },
            permissionOverrides: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })

    // Check if session is valid
    if (
      !session ||
      session.expiresAt < new Date() ||
      session.userId !== payload.data.sub
    ) {
      return null
    }

    // Omit password from user object
    const { password: _, ...user } = session.user

    return {
      user,
      session
    }
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

/**
 * Logout user by invalidating session and all refresh tokens
 */
export async function logout(sessionId: string): Promise<boolean> {
  try {
    // Revoke all refresh tokens for this session
    await prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { isRevoked: true }
    })

    // Delete the session
    await prisma.session.delete({ where: { id: sessionId } })
    return true
  } catch (error) {
    console.error('Logout error:', error)
    return false
  }
}

/**
 * Authorize a user based on permissions
 */
export async function authorize(
  user: Prisma.UserGetPayload<{
    include: {
      roles: {
        include: {
          permissions: {
            select: { id: true; name: true }
          }
        }
      }
      permissionOverrides: {
        include: {
          permission: true
        }
      }
    }
  }>,
  options: AuthorizeOptions
): Promise<boolean> {
  if (!options.requiredPermissions?.length && !options.anyOf?.length) {
    return true
  }

  if (options.requiredPermissions?.length) {
    for (const permission of options.requiredPermissions) {
      const hasRequired = hasPermission(user, permission)
      if (!hasRequired) return false
    }
    return true
  }

  if (options.anyOf?.length) {
    return hasAnyPermission(user, options.anyOf)
  }

  return false
}

/**
 * Get current session from authorization header (for server-side usage)
 */
export async function auth(authHeader?: string): Promise<{
  user: Prisma.UserGetPayload<{
    include: {
      roles: {
        include: {
          permissions: {
            select: { id: true; name: true }
          }
        }
      }
      permissionOverrides: {
        include: {
          permission: true
        }
      }
    }
    omit: {
      password: true
    }
  }>
  session: Session
} | null> {
  if (!authHeader) return null

  // Extract token from Bearer authorization header
  const token = authHeader.split(' ')[1]
  if (!token) return null

  // Validate the token
  return await validateToken(token)
}
