import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, JwtPayload } from '../utils/token.utils';
import prisma from '../lib/prisma';
import { ACCESS_TOKEN_COOKIE } from '../lib/cookies';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const DEMO_ENABLED = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';

// JwtPayload interface now imported from token.utils

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
export type { JwtPayload };

// Verify JWT token middleware (reads from Authorization header OR httpOnly cookie)
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // 1. Prefer Authorization header (API clients / mobile)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fall back to httpOnly cookie (browser clients)
    if (!token && req.cookies?.[ACCESS_TOKEN_COOKIE]) {
      token = req.cookies[ACCESS_TOKEN_COOKIE];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    try {
      const decoded = verifyAccessToken(token);
      
      // Skip database lookup for demo users (they don't exist in the DB)
      if (decoded.userId.startsWith('demo-')) {
        req.user = decoded;
        return next();
      }

      // Verify user still exists and is active
      let user;
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, isActive: true }
        });
      } catch (dbError) {
        // Database unavailable — if in dev mode, allow request through
        if (DEMO_ENABLED) {
          req.user = decoded;
          return next();
        }
        return res.status(503).json({
          success: false,
          error: 'Database unavailable.'
        });
      }

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive.'
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // 1. Prefer Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fall back to httpOnly cookie (browser clients)
    if (!token && req.cookies?.[ACCESS_TOKEN_COOKIE]) {
      token = req.cookies[ACCESS_TOKEN_COOKIE];
    }

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
      } catch {
        // Token invalid, but continue without user
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Role-based authorization
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. Not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Admin only middleware
export const adminOnly = authorize('ADMIN');

// Generate tokens
export const generateTokens = (user: { id: string; email: string; role: string }) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET || JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};
