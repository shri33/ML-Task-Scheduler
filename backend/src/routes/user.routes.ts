import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).optional()
});

/**
 * @route GET /api/v1/users
 * @desc Get all users (Admin only)
 */
router.get('/', authenticate, adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/v1/users/:id
 * @desc Update user details (Admin only)
 */
router.patch('/:id', authenticate, adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        isActive: true
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

/**
 * @route GET /api/v1/users/notifications
 * @desc Get system notifications/logs for the current user
 */
router.get('/notifications', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Fetch TaskEvents and AuditLogs as "notifications"
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

    // Map to a unified "notification" format
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

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
});

export default router;
