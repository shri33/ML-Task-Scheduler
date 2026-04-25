import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, verifyRefreshToken, verifyTokenCustom } from '../utils/token.utils';
import prisma from '../lib/prisma';
import { authenticate, generateTokens, AuthRequest } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { setTokenCookies, clearTokenCookies, REFRESH_TOKEN_COOKIE } from '../lib/cookies';
import { setCsrfCookie, COOKIE_SECURE } from '../middleware/csrf.middleware';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;

if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error('JWT_SECRET (or ACCESS_TOKEN_SECRET) and REFRESH_TOKEN_SECRET are required');
}

// Demo user for development without database (disabled in production)
const DEMO_ENABLED = process.env.NODE_ENV !== 'production';
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'ADMIN',
  createdAt: new Date().toISOString()
};
const DEMO_PASSWORD = 'password123';
const OAUTH_STATE_COOKIE = 'oauth_state';

function getFrontendBaseUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
}

function getGoogleRedirectUri(req: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
}

function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function frontendAuthRedirect(path: string): string {
  const base = getFrontendBaseUrl().replace(/\/$/, '');
  return `${base}${path}`;
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Google OAuth start
router.get('/google', (req: Request, res: Response) => {
  if (!googleEnabled()) {
    return res.redirect(frontendAuthRedirect('/login?error=google_not_configured'));
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: (COOKIE_SECURE ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'offline',
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    if (!googleEnabled()) {
      return res.redirect(frontendAuthRedirect('/login?error=google_not_configured'));
    }

    const { code, state } = req.query as { code?: string; state?: string };
    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.redirect(frontendAuthRedirect('/login?error=invalid_oauth_state'));
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(frontendAuthRedirect('/login?error=google_token_exchange_failed'));
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      return res.redirect(frontendAuthRedirect('/login?error=missing_google_access_token'));
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      return res.redirect(frontendAuthRedirect('/login?error=google_profile_fetch_failed'));
    }

    const profile = await profileResponse.json() as {
      email?: string;
      name?: string;
      email_verified?: boolean;
      sub?: string;
    };

    if (!profile.email || !profile.email_verified) {
      return res.redirect(frontendAuthRedirect('/login?error=google_email_not_verified'));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: profile.email }
    });

    let user = existingUser;
    if (!user) {
      const generatedPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          password: hashedPassword,
          notifications: {
            create: {
              emailOnTaskComplete: true,
              emailOnTaskFailed: true,
              emailDailySummary: false,
            }
          }
        }
      });
    }

    if (!user.isActive) {
      return res.redirect(frontendAuthRedirect('/login?error=account_deactivated'));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    setTokenCookies(res, accessToken, refreshToken);
    setCsrfCookie(res);
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    return res.redirect(frontendAuthRedirect('/dashboard'));
  } catch {
    return res.redirect(frontendAuthRedirect('/login?error=google_auth_failed'));
  }
});

// Register new user
router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        notifications: {
          create: {
            emailOnTaskComplete: true,
            emailOnTaskFailed: true,
            emailDailySummary: false
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Set httpOnly cookies + CSRF token
    setTokenCookies(res, accessToken, refreshToken);
    setCsrfCookie(res);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { email, password } = validation.data;

    // Check for demo user (works without database, disabled in production)
    if (DEMO_ENABLED && email === DEMO_USER.email && password === DEMO_PASSWORD) {
      const { accessToken, refreshToken } = generateTokens({
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        role: DEMO_USER.role
      });

      setTokenCookies(res, accessToken, refreshToken);
      setCsrfCookie(res);

      return res.json({
        success: true,
        data: {
          user: DEMO_USER,
          accessToken,
          refreshToken
        }
      });
    }

    // Find user in database
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email }
      });
    } catch (dbError) {
      // Database not available, only demo login works
      return res.status(503).json({
        success: false,
        error: 'Database unavailable. Use demo@example.com / password123'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    setTokenCookies(res, accessToken, refreshToken);
    setCsrfCookie(res);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional()
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = refreshSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    // Read refresh token from body OR httpOnly cookie
    const refreshToken = validation.data.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokens({
      id: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role
    });

    // Atomic token rotation: delete old + create new in a single transaction
    await prisma.$transaction([
      prisma.refreshToken.delete({
        where: { id: storedToken.id }
      }),
      prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: storedToken.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = refreshSchema.safeParse(req.body);
    const refreshToken = validation.success ? validation.data.refreshToken : req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      // Delete specific refresh token
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    } else {
      // Delete all refresh tokens for this user
      await prisma.refreshToken.deleteMany({
        where: { userId: req.user!.userId }
      });
    }

    clearTokenCookies(res);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if demo user
    if (req.user!.userId === DEMO_USER.id) {
      return res.json({
        success: true,
        data: {
          user: DEMO_USER
        }
      });
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          lastLogin: true,
          createdAt: true,
          notifications: true
        }
      });
    } catch (dbError) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Update profile
const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { name, email } = validation.data;

    const updateData: Record<string, string> = {};
    if (name) updateData.name = name;
    if (email) {
      // Check if email is taken
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      if (existingUser && existingUser.id !== req.user!.userId) {
        return res.status(409).json({
          success: false,
          error: 'Email is already taken'
        });
      }
      updateData.email = email;
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

// Forgot password - Request reset
router.post('/forgot-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { email } = validation.data;

    // Check for demo user
    if (email === DEMO_USER.email) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email }
      });
    } catch (dbError) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable'
      });
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in database
    await prisma.refreshToken.create({
      data: {
        token: `reset:${resetToken}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    });

    // In production, send email with reset link
    // For demo, we'll just return success
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
      // Include token in development for testing
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    });
  } catch (error) {
    next(error);
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

// Reset password with token
router.post('/reset-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { token, newPassword } = validation.data;

    // Verify token
    let decoded: any;
    try {
      decoded = verifyTokenCustom(token, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    if (decoded.type !== 'password-reset') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // Check if reset token exists
    const storedToken = await prisma.refreshToken.findFirst({
      where: { 
        token: `reset:${token}`,
        userId: decoded.userId,
        expiresAt: { gt: new Date() }
      }
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashedPassword }
    });

    // Delete reset token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id }
    });

    // Invalidate all existing refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: decoded.userId }
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.'
    });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

// Change password
router.put('/password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { currentPassword, newPassword } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password: hashedPassword }
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user!.userId }
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
