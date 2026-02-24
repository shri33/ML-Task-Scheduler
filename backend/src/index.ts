import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import dotenv from 'dotenv';

// Load dotenv BEFORE env validation
dotenv.config();

import { validateEnv, getEnv, isProduction } from './lib/env';
import taskRoutes from './routes/task.routes';
import resourceRoutes from './routes/resource.routes';
import scheduleRoutes from './routes/schedule.routes';
import metricsRoutes from './routes/metrics.routes';
import reportsRoutes from './routes/reports.routes';
import fogRoutes from './routes/fog.routes';
import authRoutes from './routes/auth.routes';
import deviceRoutes from './routes/device.routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, scheduleLimiter } from './middleware/rateLimit.middleware';
import { csrfProtection } from './middleware/csrf.middleware';
import prisma from './lib/prisma';
import redisService from './lib/redis';
import emailService from './services/email.service';
import { setupSwagger } from './lib/swagger';
import logger, { requestLogger } from './lib/logger';
import { errorRecovery } from './services/errorRecovery.service';
import { metricsMiddleware, setupMetricsEndpoint } from './lib/metrics';
import { closeAllQueues } from './queues';

// Validate environment variables at startup (fail-fast)
const env = validateEnv();

const app = express();
const httpServer = createServer(app);

// Get CORS origin from validated env (required in production)
const corsOrigin = env.CORS_ORIGIN || (isProduction() ? undefined : 'http://localhost:3000');
if (isProduction() && !corsOrigin) {
  logger.fatal('CORS_ORIGIN is required in production');
  process.exit(1);
}

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// API Version
const API_VERSION = 'v1';

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", corsOrigin || ''].filter(Boolean),
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow cross-origin for API
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Request body size limits (prevent memory exhaustion attacks)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Request ID for distributed tracing / log correlation
import crypto from 'crypto';
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// CSRF protection for browser-based mutating requests
app.use('/api/', csrfProtection);

// Request logging middleware
app.use(requestLogger());

// Prometheus metrics middleware
app.use(metricsMiddleware());

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Make io available to routes
app.set('io', io);

// Setup Swagger API Documentation (protected in production)
setupSwagger(app, isProduction());

// Setup Prometheus metrics endpoint
setupMetricsEndpoint(app);

// ===============================
// API v1 Routes (versioned)
// ===============================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/resources', resourceRoutes);
app.use('/api/v1/schedule', scheduleLimiter, scheduleRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/fog', fogRoutes);
app.use('/api/v1/devices', deviceRoutes);

// Legacy routes removed - use versioned API only (/api/v1/*)
// Migration: Update all clients to use /api/v1/* endpoints

// Health check with circuit breaker status
app.get('/api/health', async (req, res) => {
  const circuitStatus = errorRecovery.getStatus();

  // Database connectivity check
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch { /* db unreachable */ }

  const allHealthy = dbOk && redisService.isAvailable();

  res.status(allHealthy ? 200 : 503).json({ 
    status: allHealthy ? 'ok' : 'degraded', 
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk,
      redis: redisService.isAvailable(),
      email: emailService.isAvailable()
    },
    circuitBreakers: circuitStatus
  });
});

// API version info
app.get('/api/version', (req, res) => {
  res.json({
    currentVersion: API_VERSION,
    supportedVersions: ['v1'],
    deprecatedVersions: [],
    documentation: `/api/docs`
  });
});

// Error handler
app.use(errorHandler);

// Socket.io connection
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

const PORT = env.PORT;

// Initialize services and start server
async function startServer() {
  // Connect to Redis (optional, won't fail if unavailable)
  try {
    await redisService.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn('Redis not available, continuing without cache');
  }

  // Setup Redis adapter for Socket.IO horizontal scaling
  if (redisService.isAvailable()) {
    try {
      const pubClient = redisService.getClient();
      const subClient = pubClient?.duplicate();
      if (pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter configured for horizontal scaling');
      }
    } catch (error) {
      logger.warn('Failed to setup Socket.IO Redis adapter, running single-instance mode');
    }
  }

  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`API Version: ${API_VERSION}`);
    logger.info(`API Health: http://localhost:${PORT}/api/health`);
    logger.info(`API Docs: http://localhost:${PORT}/api/docs`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closeAllQueues();
      logger.info('BullMQ queues drained and closed');
    } catch (err) {
      logger.error('Error closing queues', err);
    }
    logger.shutdown();
    process.exit(0);
  });

  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => {
    logger.fatal('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

startServer();

export { io };
