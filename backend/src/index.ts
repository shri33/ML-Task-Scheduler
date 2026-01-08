import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import taskRoutes from './routes/task.routes.js';
import resourceRoutes from './routes/resource.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import fogRoutes from './routes/fog.routes.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, scheduleLimiter } from './middleware/rateLimit.middleware.js';
import redisService from './lib/redis.js';
import emailService from './services/email.service.js';
import { setupSwagger } from './lib/swagger.js';

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redisService.isAvailable(),
      email: emailService.isAvailable()
    }
  });
});

// Error handler
app.use(errorHandler);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

// Initialize services and start server
async function startServer() {
  // Connect to Redis (optional, won't fail if unavailable)
  try {
    await redisService.connect();
  } catch (error) {
    console.log('⚠️ Redis not available, continuing without cache');
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
    console.log(`� API Docs: http://localhost:${PORT}/api/docs`);
    console.log(`�📄 Reports API: http://localhost:${PORT}/api/reports`);
  });
}

startServer();

export { io };
