/**
 * Shared JWT verification utility
 * Centralizes token verification logic to avoid duplication
 * across auth.middleware.ts, auth.routes.ts, and index.ts.
 */

import jwt from 'jsonwebtoken';
import { getEnv } from './env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** Resolve the access-token secret (JWT_SECRET from validated env). */
function getAccessSecret(): string {
  return getEnv().JWT_SECRET;
}

/** Resolve the refresh-token secret (REFRESH_TOKEN_SECRET or JWT_SECRET). */
function getRefreshSecret(): string {
  return process.env.REFRESH_TOKEN_SECRET || getEnv().JWT_SECRET;
}

/**
 * Verify an access token and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getAccessSecret()) as JwtPayload;
}

/**
 * Verify a refresh token and return the decoded payload.
 * Falls back to JWT_SECRET if REFRESH_TOKEN_SECRET is not set.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getRefreshSecret()) as JwtPayload;
}

/**
 * Sign a new access token (short-lived, 15 min default).
 */
export function signAccessToken(
  payload: { userId: string; email: string; role: string },
  expiresIn: string = '15m',
): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn } as jwt.SignOptions);
}

/**
 * Sign a new refresh token (long-lived, 7 days default).
 */
export function signRefreshToken(
  payload: { userId: string; email: string; role: string },
  expiresIn: string = '7d',
): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn } as jwt.SignOptions);
}
