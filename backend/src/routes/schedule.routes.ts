import { Router, Request, Response, NextFunction } from 'express';
import { schedulerService } from '../services/scheduler.service';
import { mlService } from '../services/ml.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// All schedule routes require authentication
router.use(authenticate);

const scheduleRequestSchema = z.object({
  taskIds: z.array(z.string().uuid()).optional()
});

// POST /api/schedule - Run scheduler
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds } = scheduleRequestSchema.parse(req.body);
    const results = await schedulerService.schedule(taskIds);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io?.emit('schedule:completed', results);
    
    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        scheduledAt: new Date().toISOString()
      }
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
    const { taskIds } = scheduleRequestSchema.parse(req.body);
    const results = await schedulerService.schedule(taskIds);
    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        scheduledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
