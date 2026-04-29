import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────────────────
const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  allDay: z.boolean().optional().default(false),
  color: z.string().max(20).optional().default('#4f46e5'),
  taskId: z.string().uuid().optional(), // Link to existing task
});

const updateEventSchema = createEventSchema.partial();

// ─── Calendar Events via Tasks ───────────────────────────────────────
// The calendar shows tasks with dueDate/scheduledAt.
// For dedicated calendar events, we use SystemMetrics as a lightweight
// store (or tasks with a special flag). For now, calendar events are
// tasks projected onto dates.

/**
 * GET /api/v1/calendar/events
 * Returns all tasks with dates for the calendar view, plus any
 * custom calendar events stored in the CalendarEvent model.
 */
router.get('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { start, end } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (start) dateFilter.gte = new Date(start as string);
    if (end) dateFilter.lte = new Date(end as string);

    // Fetch tasks with dates (existing behavior)
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { dueDate: Object.keys(dateFilter).length ? dateFilter : { not: null } },
          { scheduledAt: Object.keys(dateFilter).length ? dateFilter : { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        type: true,
        dueDate: true,
        scheduledAt: true,
        completedAt: true,
        resource: { select: { name: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    // Map tasks to calendar event format
    const events = tasks.map(task => ({
      id: task.id,
      title: task.name,
      start: task.scheduledAt || task.dueDate,
      end: task.completedAt || task.scheduledAt || task.dueDate,
      allDay: false,
      color: getStatusColor(task.status),
      type: 'task' as const,
      meta: {
        status: task.status,
        priority: task.priority,
        taskType: task.type,
        resource: task.resource?.name
      }
    }));

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/calendar/events
 * Creates a new task with a dueDate (effectively a calendar event)
 */
router.post('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const validation = createEventSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { title, description, startDate, endDate, taskId } = validation.data;

    if (taskId) {
      // Update existing task's dueDate
      const task = await prisma.task.update({
        where: { id: taskId },
        data: { dueDate: new Date(startDate) }
      });
      return res.json({ success: true, data: task });
    }

    // Create a new task as the calendar event
    const task = await prisma.task.create({
      data: {
        name: title,
        type: 'MIXED',
        size: 'MEDIUM',
        priority: 3,
        dueDate: new Date(startDate),
        userId: userId.startsWith('demo-') ? null : userId,
      }
    });

    const io = req.app.get('io');
    io?.emit('task:created', task);

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/calendar/events/:id
 * Reschedule a task (drag-and-drop on calendar)
 */
router.patch('/events/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    const updateData: any = {};
    if (startDate) updateData.dueDate = new Date(startDate);
    if (endDate) updateData.scheduledAt = new Date(endDate);

    const task = await prisma.task.update({
      where: { id },
      data: updateData
    });

    const io = req.app.get('io');
    io?.emit('task:updated', task);

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/calendar/events/:id
 * Soft-delete a calendar event (task)
 */
router.delete('/events/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    const io = req.app.get('io');
    io?.emit('task:deleted', { id });

    res.json({ success: true, message: 'Event removed' });
  } catch (error) {
    next(error);
  }
});

// Helper
function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return '#f59e0b';
    case 'SCHEDULED': return '#3b82f6';
    case 'RUNNING': return '#8b5cf6';
    case 'COMPLETED': return '#10b981';
    case 'FAILED': return '#ef4444';
    default: return '#6b7280';
  }
}

export default router;
