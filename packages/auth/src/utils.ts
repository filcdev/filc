import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import type { TokenPayload } from "./types";

export const SESSION_EXPIRY_DAYS = 30;
const JWT_SECRET = process.env.JWT_SECRET ?? "supersecret";

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * Create a JWT token
 */
export function createToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: `${SESSION_EXPIRY_DAYS}d`,
  });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Calculate future expiration date for sessions
 */
export function getExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + SESSION_EXPIRY_DAYS);
  return expiryDate;
}

/**
 * Extract authorization token from request headers
 */
export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}