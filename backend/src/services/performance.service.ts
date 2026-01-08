import { Request, Response, NextFunction } from 'express';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  memoryUsage: number;
  cpuUsage?: number;
}

interface AggregatedMetrics {
  totalRequests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  endpointMetrics: Map<string, EndpointMetric>;
}

interface EndpointMetric {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  errors: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 10000;
  private readonly aggregationInterval = 60000; // 1 minute
  private aggregatedData: AggregatedMetrics | null = null;
  private lastAggregation = Date.now();

  constructor() {
    // Aggregate metrics every minute
    setInterval(() => this.aggregate(), this.aggregationInterval);
  }

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp' | 'memoryUsage'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    };

    this.metrics.push(fullMetric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics / 2);
    }
  }

  private aggregate(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentMetrics = this.metrics.filter(
      (m) => m.timestamp.getTime() > oneMinuteAgo
    );

    if (recentMetrics.length === 0) {
      this.aggregatedData = null;
      return;
    }

    const endpointMetrics = new Map<string, EndpointMetric>();
    let totalResponseTime = 0;
    let maxResponseTime = 0;
    let minResponseTime = Infinity;
    let errorCount = 0;

    for (const metric of recentMetrics) {
      totalResponseTime += metric.responseTime;
      maxResponseTime = Math.max(maxResponseTime, metric.responseTime);
      minResponseTime = Math.min(minResponseTime, metric.responseTime);

      if (metric.statusCode >= 400) {
        errorCount++;
      }

      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointMetrics.get(key) || {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        errors: 0,
      };

      existing.count++;
      existing.totalTime += metric.responseTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.maxTime = Math.max(existing.maxTime, metric.responseTime);
      existing.minTime = Math.min(existing.minTime, metric.responseTime);
      if (metric.statusCode >= 400) existing.errors++;

      endpointMetrics.set(key, existing);
    }

    this.aggregatedData = {
      totalRequests: recentMetrics.length,
      avgResponseTime: totalResponseTime / recentMetrics.length,
      maxResponseTime,
      minResponseTime: minResponseTime === Infinity ? 0 : minResponseTime,
      errorRate: (errorCount / recentMetrics.length) * 100,
      requestsPerMinute: recentMetrics.length,
      endpointMetrics,
    };

    this.lastAggregation = now;
  }

  getMetrics(): AggregatedMetrics | null {
    return this.aggregatedData;
  }

  getRecentMetrics(count = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    memory: { used: number; total: number; percentage: number };
    uptime: number;
    responseTime: { avg: number; max: number };
    errorRate: number;
  } {
    const memUsage = process.memoryUsage();
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    const metrics = this.aggregatedData;
    const avgResponseTime = metrics?.avgResponseTime || 0;
    const maxResponseTime = metrics?.maxResponseTime || 0;
    const errorRate = metrics?.errorRate || 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 10 || avgResponseTime > 5000 || memoryPercentage > 90) {
      status = 'unhealthy';
    } else if (errorRate > 5 || avgResponseTime > 2000 || memoryPercentage > 75) {
      status = 'degraded';
    }

    return {
      status,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round(memoryPercentage),
      },
      uptime: Math.round(process.uptime()),
      responseTime: {
        avg: Math.round(avgResponseTime),
        max: Math.round(maxResponseTime),
      },
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  getSlowestEndpoints(limit = 10): { endpoint: string; avgTime: number; count: number }[] {
    if (!this.aggregatedData) return [];

    const endpoints = Array.from(this.aggregatedData.endpointMetrics.entries())
      .map(([endpoint, metric]) => ({
        endpoint,
        avgTime: metric.avgTime,
        count: metric.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return endpoints;
  }

  getErrorEndpoints(limit = 10): { endpoint: string; errors: number; errorRate: number }[] {
    if (!this.aggregatedData) return [];

    const endpoints = Array.from(this.aggregatedData.endpointMetrics.entries())
      .filter(([_, metric]) => metric.errors > 0)
      .map(([endpoint, metric]) => ({
        endpoint,
        errors: metric.errors,
        errorRate: (metric.errors / metric.count) * 100,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);

    return endpoints;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware for automatic performance tracking
export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Override res.end to capture response
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
    const responseTime = Date.now() - startTime;

    // Don't track health checks and static assets
    if (!req.path.includes('/health') && !req.path.includes('/static')) {
      performanceMonitor.recordMetric({
        endpoint: req.route?.path || req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userId: (req as any).user?.userId,
      });
    }

    return originalEnd(chunk, encoding, callback);
  };

  next();
};

// Routes for performance monitoring
import { Router } from 'express';

export const performanceRouter = Router();

/**
 * @swagger
 * /api/performance/metrics:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: Performance metrics
 */
performanceRouter.get('/metrics', (req: Request, res: Response) => {
  const metrics = performanceMonitor.getMetrics();
  
  res.json({
    success: true,
    data: metrics
      ? {
          ...metrics,
          endpointMetrics: Object.fromEntries(metrics.endpointMetrics),
        }
      : null,
  });
});

/**
 * @swagger
 * /api/performance/health:
 *   get:
 *     summary: Get system health
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: System health status
 */
performanceRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: performanceMonitor.getSystemHealth(),
  });
});

/**
 * @swagger
 * /api/performance/slowest:
 *   get:
 *     summary: Get slowest endpoints
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: Slowest endpoints
 */
performanceRouter.get('/slowest', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  
  res.json({
    success: true,
    data: performanceMonitor.getSlowestEndpoints(limit),
  });
});

/**
 * @swagger
 * /api/performance/errors:
 *   get:
 *     summary: Get endpoints with errors
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: Endpoints with errors
 */
performanceRouter.get('/errors', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  
  res.json({
    success: true,
    data: performanceMonitor.getErrorEndpoints(limit),
  });
});

/**
 * @swagger
 * /api/performance/recent:
 *   get:
 *     summary: Get recent requests
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: Recent requests
 */
performanceRouter.get('/recent', (req: Request, res: Response) => {
  const count = parseInt(req.query.count as string) || 100;
  
  res.json({
    success: true,
    data: performanceMonitor.getRecentMetrics(count),
  });
});
