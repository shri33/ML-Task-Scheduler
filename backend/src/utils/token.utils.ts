import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET (or ACCESS_TOKEN_SECRET) is required');
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshJwtPayload {
  userId: string;
  type: string;
}

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET!) as JwtPayload;
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (token: string): RefreshJwtPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET!) as RefreshJwtPayload;
};

/**
 * Verify a generic token with a specific secret (e.g. for password reset)
 */
export const verifyTokenCustom = (token: string, secret: string) => {
  return jwt.verify(token, secret);
};
