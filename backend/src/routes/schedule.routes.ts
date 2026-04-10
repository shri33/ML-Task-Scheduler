import { Router, Request, Response, NextFunction } from 'express';
import { schedulerService, ALGORITHM_REGISTRY, SchedulingAlgorithm, makeScheduleJobId } from '../services/scheduler.service';
import { mlService } from '../services/ml.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getSchedulingQueue } from '../queues';
import { z } from 'zod';

const router = Router();

// All schedule routes require authentication
router.use(authenticate);

const scheduleRequestSchema = z.object({
  taskIds: z.array(z.string().uuid()).optional(),
  algorithm: z.enum([
    'ml_enhanced', 'hybrid_heuristic', 'ipso', 'iaco',
    'round_robin', 'min_min', 'fcfs', 'edf', 'sjf',
  ]).optional().default('ml_enhanced'),
  seed: z.number().int().optional(),
  timeBudgetMs: z.number().int().min(100).max(120_000).optional(),
});

// POST /api/schedule - Run scheduler with selected algorithm
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds, algorithm, seed, timeBudgetMs } = scheduleRequestSchema.parse(req.body);
    const results = await schedulerService.schedule(
      taskIds,
      algorithm as SchedulingAlgorithm,
      { seed, timeBudgetMs }
    );
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io?.emit('schedule:completed', { results, algorithm });
    
    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        algorithm,
        seed,
        scheduledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedule/algorithms - List all available scheduling algorithms
router.get('/algorithms', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      algorithms: ALGORITHM_REGISTRY,
      default: 'ml_enhanced',
      count: ALGORITHM_REGISTRY.length,
    },
  });
});

// POST /api/schedule/compare - Run all algorithms on same tasks, return comparison
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds } = z.object({
      taskIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body);

    const comparison = await schedulerService.compareAlgorithms(taskIds);

    res.json({
      success: true,
      data: {
        comparison,
        bestAlgorithm: comparison[0]?.algorithm || null,
        totalAlgorithms: comparison.length,
        comparedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedule/async - Trigger async scheduling via BullMQ
router.post('/async', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds, algorithm, seed, timeBudgetMs } = scheduleRequestSchema.parse(req.body);

    const userId = (req as AuthRequest).user?.userId;
    const queue = getSchedulingQueue();

    // Idempotent job key: prevents duplicate schedules within 5s window
    const jobId = makeScheduleJobId(userId, taskIds || []);

    const job = await queue.add('schedule-user-tasks', {
      taskIds: taskIds || [],
      algorithm: algorithm || 'ml_enhanced',
      seed,
      timeBudgetMs,
      requestedAt: new Date().toISOString(),
      requestedBy: userId,
    }, {
      jobId,  // idempotent: same key within 5s window deduplicates
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        algorithm,
        seed,
        message: 'Scheduling job queued. You will receive a WebSocket notification when complete.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedule/history - Get scheduling history
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await schedulerService.getHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedule/comparison - Compare ML vs non-ML scheduling
router.get('/comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comparison = await schedulerService.getComparison();
    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedule/ml-status - Check ML service status
router.get('/ml-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await mlService.checkHealth();
    res.json({
      success: true,
      data: {
        mlServiceAvailable: isHealthy,
        fallbackMode: !isHealthy
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedule/preview - Preview what the scheduler would do
// NOTE: This endpoint runs the full scheduler and DOES persist assignments.
// The response includes an explanation of what was scheduled.
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds, algorithm } = scheduleRequestSchema.parse(req.body);
    const results = await schedulerService.schedule(taskIds, algorithm as SchedulingAlgorithm);
    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        algorithm,
        scheduledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
