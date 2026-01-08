import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

interface SocketUser {
  id: string;
  email: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

export class WebSocketService {
  private io: Server;
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        // Allow anonymous connections for public updates
        return next();
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
        socket.user = decoded;
        next();
      } catch (error) {
        // Allow connection but without authentication
        next();
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`📡 Socket connected: ${socket.id}`);

      // Track connected users
      if (socket.user) {
        const userSockets = this.connectedUsers.get(socket.user.id) || new Set();
        userSockets.add(socket.id);
        this.connectedUsers.set(socket.user.id, userSockets);
        
        // Join user-specific room
        socket.join(`user:${socket.user.id}`);
      }

      // Join general room
      socket.join('general');

      // Handle joining specific rooms
      socket.on('join:tasks', () => {
        socket.join('tasks');
        console.log(`Socket ${socket.id} joined tasks room`);
      });

      socket.on('join:resources', () => {
        socket.join('resources');
        console.log(`Socket ${socket.id} joined resources room`);
      });

      socket.on('join:fog-computing', () => {
        socket.join('fog-computing');
        console.log(`Socket ${socket.id} joined fog-computing room`);
      });

      // Handle leaving rooms
      socket.on('leave:tasks', () => {
        socket.leave('tasks');
      });

      socket.on('leave:resources', () => {
        socket.leave('resources');
      });

      socket.on('leave:fog-computing', () => {
        socket.leave('fog-computing');
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`📡 Socket disconnected: ${socket.id}`);
        
        if (socket.user) {
          const userSockets = this.connectedUsers.get(socket.user.id);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.connectedUsers.delete(socket.user.id);
            }
          }
        }
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  // Emit task events
  emitTaskCreated(task: any) {
    this.io.to('tasks').emit('task:created', task);
    this.io.to('general').emit('tasks:updated');
  }

  emitTaskUpdated(task: any) {
    this.io.to('tasks').emit('task:updated', task);
    this.io.to('general').emit('tasks:updated');
  }

  emitTaskDeleted(taskId: string) {
    this.io.to('tasks').emit('task:deleted', { id: taskId });
    this.io.to('general').emit('tasks:updated');
  }

  emitTasksScheduled(results: any) {
    this.io.to('tasks').emit('tasks:scheduled', results);
    this.io.to('general').emit('tasks:updated');
  }

  // Emit resource events
  emitResourceCreated(resource: any) {
    this.io.to('resources').emit('resource:created', resource);
    this.io.to('general').emit('resources:updated');
  }

  emitResourceUpdated(resource: any) {
    this.io.to('resources').emit('resource:updated', resource);
    this.io.to('general').emit('resources:updated');
  }

  emitResourceDeleted(resourceId: string) {
    this.io.to('resources').emit('resource:deleted', { id: resourceId });
    this.io.to('general').emit('resources:updated');
  }

  // Emit fog computing events
  emitFogAlgorithmStarted(algorithm: string, taskCount: number) {
    this.io.to('fog-computing').emit('fog:algorithm:started', { algorithm, taskCount });
  }

  emitFogAlgorithmProgress(algorithm: string, progress: number) {
    this.io.to('fog-computing').emit('fog:algorithm:progress', { algorithm, progress });
  }

  emitFogAlgorithmCompleted(algorithm: string, results: any) {
    this.io.to('fog-computing').emit('fog:algorithm:completed', { algorithm, results });
  }

  // Emit notification to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Emit global notification
  emitGlobalNotification(notification: any) {
    this.io.to('general').emit('notification', notification);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get all connected socket IDs
  getConnectedSockets(): string[] {
    return Array.from(this.io.sockets.sockets.keys());
  }

  // Get the Socket.IO server instance
  getIO(): Server {
    return this.io;
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

export const initWebSocket = (httpServer: HttpServer): WebSocketService => {
  if (!wsService) {
    wsService = new WebSocketService(httpServer);
    console.log('✅ WebSocket service initialized');
  }
  return wsService;
};

export const getWebSocket = (): WebSocketService | null => {
  return wsService;
};
