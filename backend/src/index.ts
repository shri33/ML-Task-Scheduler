import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import taskRoutes from './routes/task.routes';
import resourceRoutes from './routes/resource.routes';
import scheduleRoutes from './routes/schedule.routes';
import metricsRoutes from './routes/metrics.routes';
import reportsRoutes from './routes/reports.routes';
import fogRoutes from './routes/fog.routes';
import authRoutes from './routes/auth.routes';
import mlRoutes from './routes/ml.routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, scheduleLimiter } from './middleware/rateLimit.middleware';
import redisService from './lib/redis';
import emailService from './services/email.service';
import { setupSwagger } from './lib/swagger';
import { initWebSocket } from './services/websocket.service';
import { mlService } from './services/ml.service';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Make io available to routes
app.set('io', io);

// Setup Swagger API Documentation
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/schedule', scheduleLimiter, scheduleRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/fog', fogRoutes);
app.use('/api/ml', mlRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const mlHealthy = await mlService.checkHealth().catch(() => false);
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redisService.isAvailable(),
      email: emailService.isAvailable(),
      ml: mlHealthy
    }
  });
});

// Error handler
app.use(errorHandler);

// Initialize WebSocket service
const wsService = initWebSocket(httpServer);

const PORT = process.env.PORT || 3001;

// Initialize services and start server
async function startServer() {
  // Connect to Redis (optional, won't fail if unavailable)
  try {
    await redisService.connect();
  } catch (error) {
    console.log('⚠️ Redis not available, continuing without cache');
  }

  // Check ML service health on startup
  const mlHealthy = await mlService.checkHealth().catch(() => false);
  if (!mlHealthy) {
    console.log('⚠️ ML service not available, using fallback predictions');
  } else {
    console.log('✅ ML service connected');
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
    console.log(`📄 Reports API: http://localhost:${PORT}/api/reports`);
    console.log(`🤖 ML API: http://localhost:${PORT}/api/ml/status`);
  });
}

startServer();

export { io };
