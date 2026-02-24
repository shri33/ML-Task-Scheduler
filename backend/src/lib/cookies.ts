/**
 * Cookie-based token helpers
 * Centralises cookie names, options, and setter/clearer for JWT tokens.
 */

import { Response } from 'express';
import { COOKIE_SECURE } from '../middleware/csrf.middleware';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Common cookie options */
const baseCookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: (COOKIE_SECURE ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/',
};

/**
 * Set both access and refresh tokens as httpOnly cookies.
 * Also leaves them in the JSON body for backward-compatible mobile/API clients.
 */
export function setTokenCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  // Access token — short-lived
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15 min
  });

  // Refresh token — longer-lived
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/** Clear all auth cookies (used on logout). */
export function clearTokenCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };
