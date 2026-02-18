/**
 * Prometheus Metrics Service
 * Exposes application metrics for observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction, Express } from 'express';
import logger from '../lib/logger';

// Create a custom registry
const register = new Registry();

// Add default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register });

// =============================================================================
// HTTP METRICS
// =============================================================================

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request body size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// =============================================================================
// TASK METRICS
// =============================================================================

const tasksCreatedTotal = new Counter({
  name: 'tasks_created_total',
  help: 'Total number of tasks created',
  labelNames: ['type', 'size', 'priority'],
  registers: [register],
});

const tasksCompletedTotal = new Counter({
  name: 'tasks_completed_total',
  help: 'Total number of tasks completed',
  labelNames: ['type', 'size', 'status'],
  registers: [register],
});

const taskExecutionDuration = new Histogram({
  name: 'task_execution_duration_seconds',
  help: 'Task execution duration in seconds',
  labelNames: ['type', 'size'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

const activeTasksGauge = new Gauge({
  name: 'active_tasks',
  help: 'Number of currently active tasks',
  labelNames: ['status'],
  registers: [register],
});

// =============================================================================
// ML PREDICTION METRICS
// =============================================================================

const mlPredictionsTotal = new Counter({
  name: 'ml_predictions_total',
  help: 'Total number of ML predictions',
  labelNames: ['model_version', 'fallback'],
  registers: [register],
});

const mlPredictionDuration = new Histogram({
  name: 'ml_prediction_duration_seconds',
  help: 'ML prediction latency in seconds',
  labelNames: ['model_version'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const mlPredictionAccuracy = new Histogram({
  name: 'ml_prediction_accuracy',
  help: 'ML prediction accuracy (predicted vs actual)',
  labelNames: ['type'],
  buckets: [0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1],
  registers: [register],
});

// =============================================================================
// QUEUE METRICS
// =============================================================================

const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Queue job processing duration',
  labelNames: ['queue'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
  registers: [register],
});

const queueDepthGauge = new Gauge({
  name: 'queue_depth',
  help: 'Current queue depth (waiting jobs)',
  labelNames: ['queue'],
  registers: [register],
});

// =============================================================================
// SERVICE HEALTH METRICS
// =============================================================================

const serviceHealthGauge = new Gauge({
  name: 'service_health',
  help: 'Service health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
  registers: [register],
});

const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
  registers: [register],
});

const circuitBreakerFailures = new Counter({
  name: 'circuit_breaker_failures_total',
  help: 'Total circuit breaker failures',
  labelNames: ['service'],
  registers: [register],
});

// =============================================================================
// DATABASE METRICS
// =============================================================================

const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const dbConnectionsGauge = new Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
  registers: [register],
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Express middleware to collect HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    // Track request size
    const requestSize = parseInt(req.get('content-length') || '0', 10);
    
    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path || req.path || 'unknown';
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, duration);
      
      if (requestSize > 0) {
        httpRequestSize.observe({ method: req.method, route }, requestSize);
      }
    });

    next();
  };
}

/**
 * Setup metrics endpoint
 */
export function setupMetricsEndpoint(app: Express): void {
  // Metrics endpoint for Prometheus scraping
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Failed to generate metrics', error instanceof Error ? error : new Error(String(error)));
      res.status(500).end();
    }
  });

  logger.info('Metrics endpoint available at /metrics');
}

// =============================================================================
// METRIC HELPERS
// =============================================================================

export const metrics = {
  // HTTP
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,

  // Tasks  
  tasksCreatedTotal,
  tasksCompletedTotal,
  taskExecutionDuration,
  activeTasksGauge,

  // ML
  mlPredictionsTotal,
  mlPredictionDuration,
  mlPredictionAccuracy,

  // Queue
  queueJobsTotal,
  queueJobDuration,
  queueDepthGauge,

  // Health
  serviceHealthGauge,
  circuitBreakerState,
  circuitBreakerFailures,

  // Database
  dbQueryDuration,
  dbConnectionsGauge,

  // Record task creation
  recordTaskCreated(type: string, size: string, priority: number) {
    tasksCreatedTotal.inc({ type, size, priority: priority.toString() });
  },

  // Record task completion
  recordTaskCompleted(type: string, size: string, status: string, durationSeconds: number) {
    tasksCompletedTotal.inc({ type, size, status });
    taskExecutionDuration.observe({ type, size }, durationSeconds);
  },

  // Record ML prediction
  recordPrediction(modelVersion: string, durationSeconds: number, isFallback: boolean) {
    mlPredictionsTotal.inc({ 
      model_version: modelVersion, 
      fallback: isFallback.toString() 
    });
    mlPredictionDuration.observe({ model_version: modelVersion }, durationSeconds);
  },

  // Record queue job
  recordQueueJob(queue: string, status: 'completed' | 'failed', durationSeconds?: number) {
    queueJobsTotal.inc({ queue, status });
    if (status === 'completed' && durationSeconds !== undefined) {
      queueJobDuration.observe({ queue }, durationSeconds);
    }
  },

  // Update queue depth
  updateQueueDepth(queue: string, depth: number) {
    queueDepthGauge.set({ queue }, depth);
  },

  // Update service health
  updateServiceHealth(service: string, isHealthy: boolean) {
    serviceHealthGauge.set({ service }, isHealthy ? 1 : 0);
  },

  // Update circuit breaker
  updateCircuitBreaker(service: string, state: 'closed' | 'open' | 'half-open') {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    circuitBreakerState.set({ service }, stateValue);
  },

  // Record circuit breaker failure
  recordCircuitBreakerFailure(service: string) {
    circuitBreakerFailures.inc({ service });
  },
};

export default metrics;
