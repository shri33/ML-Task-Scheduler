import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { authenticate, generateTokens, AuthRequest } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Demo user for development without database
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'admin',
  createdAt: new Date().toISOString()
};
const DEMO_PASSWORD = 'password123';

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

    // Check for demo user (works without database)
    if (email === DEMO_USER.email && password === DEMO_PASSWORD) {
      const { accessToken, refreshToken } = generateTokens({
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        role: DEMO_USER.role
      });

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

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
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

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id }
    });

    // Generate new tokens
    const tokens = generateTokens({
      id: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role
    });

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

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
    const { refreshToken } = req.body;

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
router.put('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email } = req.body;

    const updateData: any = {};
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

// Forgot password - Request reset
router.post('/forgot-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

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

// Reset password with token
router.post('/reset-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
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

// Change password
router.put('/password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters'
      });
    }

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
