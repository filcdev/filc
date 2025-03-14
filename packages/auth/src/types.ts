/**
 * Core authentication types
 */

import type { Prisma } from "@filc/db";

export type Session = Prisma.SessionGetPayload<{
  include: {
    user: {
      include: {
        roles: {
          select: { id: true; name: true; description: true; color: true }
        }
      }
    }
  }
}>;

export interface TokenPayload {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  classId: string;
}

export interface AuthResult {
  user: Prisma.UserGetPayload<{
          include: {
            roles: {
              select: { id: true; name: true; description: true; color: true }
            }
          }
        }>;
  token: string;
}

export interface AuthError {
  message: string;
  code: 'auth/invalid-credentials' | 'auth/user-exists' | 'auth/unknown' | 'auth/unauthorized';
}