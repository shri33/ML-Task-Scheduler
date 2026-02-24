/**
 * CSRF Protection Middleware
 * Uses the double-submit cookie pattern:
 *  - Server sets a csrf-token cookie (not httpOnly — readable by JS)
 *  - Client sends the same value back in X-CSRF-Token header on mutating requests
 *  - Server compares cookie vs header — they must match
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that are exempt from CSRF (unauthenticated entry points). */
const CSRF_EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/demo-login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

/** Determine cookie secure flag — honour COOKIE_SECURE env, fallback to NODE_ENV. */
export const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

/** Generates a random CSRF token and sets it as a cookie. */
export function setCsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,        // JS needs to read this
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? 'strict' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 h
  });
  return token;
}

/**
 * Middleware that enforces CSRF on all non-safe requests.
 * Must be mounted after cookie-parser.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Exempt unauthenticated entry routes (no CSRF cookie yet)
  // Use baseUrl + path to get the full route (req.path is relative to mount)
  const fullPath = req.baseUrl + req.path;
  if (CSRF_EXEMPT_PATHS.some(p => fullPath === p)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token validation failed',
    });
  }

  next();
}
