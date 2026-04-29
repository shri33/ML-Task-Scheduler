import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────────────────
const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional().default('USER'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Settings Persistence ────────────────────────────────────────────
const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  emailOnTaskComplete: z.boolean().optional(),
  emailOnTaskFailed: z.boolean().optional(),
  emailDailySummary: z.boolean().optional(),
});

/**
 * GET /api/v1/users/settings
 * Get current user's settings (notification preferences)
 */
router.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    if (!prefs) {
      // Create default preferences
      prefs = await prisma.notificationPreference.create({
        data: { userId }
      });
    }

    res.json({
      success: true,
      data: {
        emailOnTaskComplete: prefs.emailOnTaskComplete,
        emailOnTaskFailed: prefs.emailOnTaskFailed,
        emailDailySummary: prefs.emailDailySummary,
        emailAddress: prefs.emailAddress,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/settings
 * Update current user's settings
 */
router.patch('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const validation = settingsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { emailOnTaskComplete, emailOnTaskFailed, emailDailySummary, ...rest } = validation.data;

    // Upsert notification preferences
    const notifData: any = {};
    if (emailOnTaskComplete !== undefined) notifData.emailOnTaskComplete = emailOnTaskComplete;
    if (emailOnTaskFailed !== undefined) notifData.emailOnTaskFailed = emailOnTaskFailed;
    if (emailDailySummary !== undefined) notifData.emailDailySummary = emailDailySummary;

    if (Object.keys(notifData).length > 0) {
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, ...notifData },
        update: notifData,
      });
    }

    res.json({ success: true, data: { message: 'Settings updated' } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/notifications
 * Get system notifications/logs for the current user
 */
router.get('/notifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const [taskEvents, auditLogs] = await Promise.all([
      prisma.taskEvent.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 20
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 20
      })
    ]);

    const notifications = [
      ...taskEvents.map(e => ({
        id: e.id,
        type: 'TASK',
        title: `Task ${e.eventType.charAt(0).toUpperCase() + e.eventType.slice(1)}`,
        message: `Task event "${e.eventType}" occurred.`,
        timestamp: e.timestamp,
        read: false
      })),
      ...auditLogs.map(a => ({
        id: a.id,
        type: 'SYSTEM',
        title: 'System Audit',
        message: `Action "${a.action}" performed.`,
        timestamp: a.timestamp,
        read: true
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users
 * List all users (Admin only)
 */
router.get('/', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:id
 * Get single user details (Admin only)
 */
router.get('/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { tasks: true, scheduleHistories: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users
 * Create a new user (Admin only)
 */
router.post('/', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { email, name, role, password } = validation.data;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, name, role, password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      }
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/:id
 * Update user details (Admin only)
 */
router.patch('/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: validation.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/users/:id
 * Soft-delete a user (Admin only)
 */
router.delete('/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.userId;

    // Prevent self-deletion
    if (id === currentUserId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    next(error);
  }
});

export default router;
