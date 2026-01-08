import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task.service';
import { createTaskSchema, updateTaskSchema } from '../validators/task.validator';
import { AppError } from '../middleware/errorHandler';

type TaskStatus = 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

const router = Router();

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
    const status = req.query.status as TaskStatus | undefined;
    const tasks = await taskService.findAll(status);
    res.json({ success: true, data: tasks });
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const data = createTaskSchema.parse(req.body);
    const task = await taskService.create(data);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io?.emit('task:created', task);
    
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
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await taskService.update(req.params.id, data);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:updated', task);
    
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

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
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await taskService.delete(req.params.id);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:deleted', { id: req.params.id });
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
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
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actualTime } = req.body;
    if (typeof actualTime !== 'number') {
      throw new AppError('actualTime is required and must be a number', 400);
    }
    
    const task = await taskService.markCompleted(req.params.id, actualTime);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('task:completed', task);
    
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

export default router;
