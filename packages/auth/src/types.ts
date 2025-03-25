/**
 * Core authentication types
 */

import type { Prisma } from '@filc/db'
import type { PermissionType } from '@filc/rbac'

export type Session = Prisma.SessionGetPayload<{
  include: {
    user: {
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
    }
  }
}>

export type User = Prisma.UserGetPayload<{
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
    },
  }
  omit: {
    password: true
  }
}>

export interface TokenPayload {
  data: {
    sub: string
    sessionId: string
  }
  iat: number
  exp: number
}

export interface RefreshTokenPayload {
  data: {
    sub: string
    sessionId: string
    tokenId: string
  }
  iat: number
  exp: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  roles?: string[] // Role IDs to assign
}

export interface CompleteOnboardingData {
  username: string
  classId: string
}

export interface AuthResult {
  user: User
  token: string
  refreshToken: string
}

export interface AuthError {
  message: string
  code:
    | 'auth/invalid-credentials'
    | 'auth/user-exists'
    | 'auth/unknown'
    | 'auth/unauthorized'
    | 'auth/invalid-token'
    | 'auth/expired-token'
    | 'auth/invalid-class'
    | 'auth/verification-failed'
    | 'auth/already-verified'
    | 'auth/not-verified'
}

export interface AuthorizeOptions {
  requiredPermissions?: PermissionType[]
  anyOf?: PermissionType[]
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  token: string
  refreshToken: string
}
