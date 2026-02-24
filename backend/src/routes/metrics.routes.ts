import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { taskService } from '../services/task.service';
import { resourceService } from '../services/resource.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All metrics routes require authentication
router.use(authenticate);

// GET /api/metrics - Get system metrics
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [taskStats, resourceStats, recentHistory] = await Promise.all([
      taskService.getStats(),
      resourceService.getStats(),
      prisma.scheduleHistory.findMany({
        where: { actualTime: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    // Calculate prediction accuracy
    let avgAccuracy = 0;
    if (recentHistory.length > 0) {
      const accuracies = recentHistory.map((h: { predictedTime: number | null; actualTime: number | null }) => {
        if (!h.predictedTime || !h.actualTime) return 1;
        const error = Math.abs(h.predictedTime - h.actualTime);
        const accuracy = Math.max(0, 1 - (error / h.actualTime));
        return accuracy;
      });
      avgAccuracy = accuracies.reduce((a: number, b: number) => a + b, 0) / accuracies.length;
    }

    // Calculate average execution time
    const avgExecutionTime = recentHistory.length > 0
      ? recentHistory.reduce((sum: number, h: { actualTime: number | null }) => sum + (h.actualTime || 0), 0) / recentHistory.length
      : 0;

    res.json({
      success: true,
      data: {
        tasks: taskStats,
        resources: resourceStats,
        performance: {
          avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
          mlAccuracy: Math.round(avgAccuracy * 100),
          totalScheduled: recentHistory.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/metrics/timeline - Get metrics over time
router.get('/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await prisma.scheduleHistory.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        predictedTime: true,
        actualTime: true,
        mlEnabled: true
      }
    });

    // Group by day
    const groupedByDay: Record<string, { tasks: number; avgTime: number; accuracy: number }> = {};
    
    interface HistoryItem {
      createdAt: Date;
      predictedTime: number | null;
      actualTime: number | null;
      mlEnabled: boolean;
    }
    
    history.forEach((h: HistoryItem) => {
      const day = h.createdAt.toISOString().split('T')[0];
      if (!groupedByDay[day]) {
        groupedByDay[day] = { tasks: 0, avgTime: 0, accuracy: 0 };
      }
      groupedByDay[day].tasks++;
      groupedByDay[day].avgTime += h.actualTime || 0;
      if (h.predictedTime && h.actualTime) {
        const error = Math.abs(h.predictedTime - h.actualTime);
        groupedByDay[day].accuracy += Math.max(0, 1 - (error / h.actualTime));
      }
    });

    // Calculate averages
    const timeline = Object.entries(groupedByDay).map(([date, data]) => ({
      date,
      tasksScheduled: data.tasks,
      avgExecutionTime: Math.round((data.avgTime / data.tasks) * 100) / 100,
      mlAccuracy: Math.round((data.accuracy / data.tasks) * 100)
    }));

    res.json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
});

export default router;
