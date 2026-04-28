import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task.service';
import { createTaskSchema, updateTaskSchema } from '../validators/task.validator';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import { getSchedulingQueue } from '../queues';
import { JOB_NAMES, TaskEventJobData } from '../queues/types';
import logger from '../lib/logger';
import { z } from 'zod';
import { validateUUID, sanitizeBody } from '../middleware/validate.middleware';

/** Emit a task event to the scheduling queue (non-blocking, best-effort). */
async function emitTaskEvent(
  eventType: TaskEventJobData['eventType'],
  taskId: string,
  userId?: string
): Promise<void> {
  try {
    const queue = getSchedulingQueue();
    await queue.add(JOB_NAMES.TASK_EVENT, {
      eventType,
      taskId,
      userId,
      requestedAt: new Date().toISOString(),
    } satisfies TaskEventJobData);
  } catch (err) {
    // Queue errors should never block task CRUD
    logger.warn('Failed to emit task event to queue (non-critical)', { eventType, taskId, error: String(err) });
  }
}

type TaskStatus = 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

const router = Router();

// All task routes require authentication
router.use(authenticate);

// Sanitize all incoming body content to prevent XSS
router.use(sanitizeBody);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SCHEDULED, RUNNING, COMPLETED, FAILED]
 *         description: Filter by task status
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user?.userId;
    const status = req.query.status as TaskStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    
    // In a real multi-tenant system, we should pass userId to findAll.
    // For now we assume findAll inside task.service has been updated, or we update it next.
    const result = await taskService.findAll(status, { page, limit }, userId);
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/bulk:
 *   post:
 *     summary: Bulk create tasks
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tasks]
 *             properties:
 *               tasks:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/CreateTask'
 *                 maxItems: 100
 *     responses:
 *       201:
 *         description: Tasks created successfully
 *       400:
 *         description: Validation error
 */
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new AppError('tasks array is required and must not be empty', 400);
    }
    if (tasks.length > 100) {
      throw new AppError('Maximum 100 tasks per bulk create', 400);
    }
    const userId = (req as AuthRequest).user?.userId;
    const validated = tasks.map((t: unknown) => createTaskSchema.parse(t));
    const created = await taskService.bulkCreate(validated, userId);

    const io = req.app.get('io');
    io?.emit('tasks:updated', { count: created.length });

    res.status(201).json({ success: true, data: created, count: created.length });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/stats:
 *   get:
 *     summary: Get task statistics
 *     tags: [Tasks]
 *     responses:
 *       200:
 *         description: Task statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await taskService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
router.get('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.findById(req.params.id);
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTask'
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation error
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user?.userId;
    const data = createTaskSchema.parse(req.body);
    const task = await taskService.create(data, userId);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io?.emit('task:created', task);

    // Trigger async scheduling via BullMQ
    emitTaskEvent('task_created', task.id, (req as AuthRequest).user?.userId);
    
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTask'
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 */
router.put('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await taskService.update(req.params.id, data);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:updated', task);

    // Trigger async re-scheduling
    emitTaskEvent('task_updated', task.id, (req as AuthRequest).user?.userId);
    
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

import { auditService } from '../services/audit.service';

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 */
router.delete('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user?.userId;
    await taskService.delete(req.params.id);
    
    // Audit log
    if (userId) {
      await auditService.logTask(userId, 'DELETE', req.params.id);
    }
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:deleted', { id: req.params.id });

    // Notify scheduler about deletion
    emitTaskEvent('task_deleted', req.params.id, (req as AuthRequest).user?.userId);
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
});

const completeTaskSchema = z.object({
  actualTime: z.number().positive('Actual time must be positive')
});

/**
 * @swagger
 * /api/tasks/{id}/complete:
 *   post:
 *     summary: Mark task as completed
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualTime
 *             properties:
 *               actualTime:
 *                 type: number
 *                 description: Actual execution time in seconds
 *     responses:
 *       200:
 *         description: Task marked as completed
 */
router.post('/:id/complete', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = completeTaskSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(validation.error.errors[0].message, 400);
    }
    
    const { actualTime } = validation.data;
    
    const task = await taskService.markCompleted(req.params.id, actualTime);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:completed', task);

    // Log completion for ML feedback loop (actual vs predicted)
    emitTaskEvent('task_completed', req.params.id, (req as AuthRequest).user?.userId);
    
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

export default router;
