import { z } from 'zod'

import type { Prisma, Session } from '@filc/db'
import {
  prisma,
  PrismaClientKnownRequestError,
  PrismaClientValidationError
} from '@filc/db'
import { hasAnyPermission, hasPermission } from '@filc/rbac'

import type {
  AuthError,
  AuthorizeOptions,
  AuthResult,
  CompleteOnboardingData,
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
  generateVerificationToken,
  getExpiryDate,
  getRefreshTokenExpiryDate,
  getVerificationExpiry,
  hashPassword,
  isVerificationExpired,
  verifyRefreshToken,
  verifyToken
} from './utils'

// Schema validations
export const loginSchema = z.object({
  email: z.string().email('Kérlek adj meg egy érvényes email címet!'),
  password: z
    .string()
    .min(8, 'A jelszó legalább 8 karakter hosszú kell, hogy legyen!')
})

export const registerSchema = z.object({
  email: z.string().email('Kérlek adj meg egy érvényes email címet!'),
  password: z
    .string()
    .min(8, 'A jelszó legalább 8 karakter hosszú kell, hogy legyen!')
    .max(100, 'A jelszó túl hosszú!')
    .refine(
      (password) => /[A-Z]/.test(password),
      'A jelszónak tartalmaznia kell legalább egy nagybetűt!'
    )
    .refine(
      (password) => /[a-z]/.test(password),
      'A jelszónak tartalmaznia kell legalább egy kisbetűt!'
    )
    .refine(
      (password) => /[0-9]/.test(password),
      'A jelszónak tartalmaznia kell legalább egy számot!'
    )
    .refine(
      (password) => /[^A-Za-z0-9]/.test(password),
      'A jelszónak tartalmaznia kell legalább egy speciális karaktert!'
    ),
  roles: z.array(z.string()).optional()
})

export const verifyEmailSchema = z.object({
  token: z.string()
})

export const completeOnboardingSchema = z.object({
  username: z
    .string()
    .min(3, 'A felhasználónév minimum 3 karakter hosszú kell, hogy legyen!')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'A felhasználónév csak betűket, számokat és aláhúzásokat tartalmazhat!'
    )
    .max(20, 'A felhasználónév maximum 20 karakter hosszú lehet!'),
  classId: z.string()
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
        message: 'Érvénytelen email vagy jelszó formátum'
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
        message: 'Érvénytelen email vagy jelszó'
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
        message: 'Érvénytelen email vagy jelszó'
      }
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return {
        code: 'auth/not-verified',
        message: 'Kérlek erősítsd meg az email címed a folytatás előtt'
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
      message: 'Váratlan hiba történt a bejelentkezés során'
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
        message: 'Érvénytelen regisztrációs adatok'
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email
      }
    })

    if (existingUser) {
      return {
        code: 'auth/user-exists',
        message: 'Ez az email cím már használatban van'
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password)

    // Generate verification token
    const verificationToken = generateVerificationToken()
    const verificationExpires = getVerificationExpiry()

    // Create user with verification token but without username and classId
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        verificationToken,
        verificationExpires,
        isEmailVerified: false,
        isOnboarded: false,
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

    // TODO: Implement email sending service to send verification emails
    console.log(`Verification email sent to ${data.email} with token ${verificationToken}`)

    // Remove password from user object
    const { password: _, ...safeUser } = user
    return {
      user: safeUser,
      token: '', // No token since email needs verification
      refreshToken: ''
    }
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          code: 'auth/user-exists',
          message: 'Ez az email cím vagy felhasználónév már használatban van'
        }
      }
    }
    if (error instanceof PrismaClientValidationError) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Érvénytelen regisztrációs adatok'
      }
    }

    console.error('Registration error:', error)
    return {
      code: 'auth/unknown',
      message: 'Váratlan hiba történt a regisztráció során'
    }
  }
}

/**
 * Verify email using token
 */
export async function verifyEmail(
  token: string
): Promise<AuthResult | AuthError> {
  try {
    if (!token || token.length < 32) {
      return {
        code: 'auth/verification-failed',
        message: 'Érvénytelen megerősítő kód'
      }
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token
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

    if (!user) {
      return {
        code: 'auth/verification-failed',
        message: 'Érvénytelen vagy lejárt megerősítő kód'
      }
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return {
        code: 'auth/already-verified',
        message: 'Az email cím már meg lett erősítve'
      }
    }

    // Check if token expired
    if (
      !user.verificationExpires ||
      isVerificationExpired(user.verificationExpires)
    ) {
      return {
        code: 'auth/verification-failed',
        message: 'A megerősítő kód lejárt'
      }
    }

    // Mark user as verified and clear verification token
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationExpires: null
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

    // Create session (without token since onboarding is not complete)
    const { password: _, ...safeUser } = updatedUser
    return {
      user: safeUser,
      token: '',
      refreshToken: ''
    }
  } catch (error) {
    console.error('Email verification error:', error)
    return {
      code: 'auth/unknown',
      message: 'Váratlan hiba történt az email megerősítése során'
    }
  }
}

/**
 * Resend verification email
 */
export async function resendVerification(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return {
        success: false,
        message: 'Nem található felhasználó ezzel az email címmel'
      }
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return {
        success: false,
        message: 'Ez az email cím már meg lett erősítve'
      }
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const verificationExpires = getVerificationExpiry()

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpires
      }
    })

    // TODO: Implement actual email sending functionality with proper templates
    console.log(`Verification email sent to ${email} with token ${verificationToken}`)

    return {
      success: true,
      message: 'Megerősítő email újraküldve'
    }
  } catch (error) {
    console.error('Resend verification error:', error)
    return {
      success: false,
      message: 'Váratlan hiba történt a megerősítő email újraküldése során'
    }
  }
}

/**
 * Complete user onboarding by setting username and class
 */
export async function completeOnboarding(
  userId: string,
  data: CompleteOnboardingData
): Promise<AuthResult | AuthError> {
  try {
    // Validate onboarding data
    const result = completeOnboardingSchema.safeParse(data)
    if (!result.success) {
      return {
        code: 'auth/invalid-credentials',
        message: 'Érvénytelen onboarding adatok'
      }
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    })

    if (existingUsername) {
      return {
        code: 'auth/user-exists',
        message: 'Ez a felhasználónév már használatban van'
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        code: 'auth/unauthorized',
        message: 'Nem található felhasználó'
      }
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return {
        code: 'auth/not-verified',
        message: 'Kérlek erősítsd meg az email címed a folytatás előtt'
      }
    }

    // Complete onboarding
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        classId: data.classId,
        isOnboarded: true
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
    const session = await createSession(updatedUser.id)

    // Create tokens
    const { token, refreshToken } = await createTokenPair(
      updatedUser.id,
      session.id
    )

    // Remove password from user object
    const { password: _, ...safeUser } = updatedUser
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
          message: 'Ez a felhasználónév már használatban van'
        }
      }
      if (error.code === 'P2003') {
        return {
          code: 'auth/invalid-class',
          message: 'Érvénytelen osztályazonosító'
        }
      }
    }

    console.error('Onboarding error:', error)
    return {
      code: 'auth/unknown',
      message: 'Váratlan hiba történt az onboarding során'
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
        message: 'Érvénytelen token formátum'
      }
    }

    // Verify the refresh token JWT
    const payload = await verifyRefreshToken(refreshTokenRequest.refreshToken)
    if (!payload) {
      return {
        code: 'auth/invalid-token',
        message: 'Érvénytelen token'
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
        message: 'A token nem található vagy lejárt'
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
      message: 'Váratlan hiba történt a token frissítése során'
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
