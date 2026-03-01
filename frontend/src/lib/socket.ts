import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

// Get socket URL from env or use same origin (proxied by nginx)
const getSocketUrl = (): string => {
  const apiUrl = import.meta.env?.VITE_API_URL as string | undefined;
  if (apiUrl) {
    return apiUrl.replace('/api', '');
  }
  // In Docker, nginx proxies /socket.io to backend — use same origin
  return '';
};

const SOCKET_URL = getSocketUrl();
const isDev = import.meta.env?.DEV === true;

// Only log in development to avoid noisy production console
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    const store = useStore.getState();

    // Connection events
    this.socket.on('connect', () => {
      devLog('🔌 WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      devLog('🔌 WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      devLog('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    // Task events
    this.socket.on('task:created', (task) => {
      devLog('📥 Task created:', task.name);
      store.addTask(task);
    });

    this.socket.on('task:updated', (task) => {
      devLog('📝 Task updated:', task.name);
      store.updateTask(task);
    });

    this.socket.on('task:deleted', (data) => {
      devLog('🗑️ Task deleted:', data.id);
      store.removeTask(data.id);
    });

    this.socket.on('task:scheduled', (task) => {
      devLog('📅 Task scheduled:', task.name);
      store.updateTask(task);
    });

    this.socket.on('task:completed', (task) => {
      devLog('✅ Task completed:', task.name);
      store.updateTask(task);
    });

    // Resource events
    this.socket.on('resource:created', (resource) => {
      devLog('📥 Resource created:', resource.name);
      store.addResource(resource);
    });

    this.socket.on('resource:updated', (resource) => {
      devLog('📝 Resource updated:', resource.name);
      store.updateResource(resource);
    });

    this.socket.on('resource:deleted', (data) => {
      devLog('🗑️ Resource deleted:', data.id);
      store.removeResource(data.id);
    });

    // Schedule events
    this.socket.on('schedule:completed', (data) => {
      devLog('🎯 Scheduling completed:', data.count, 'tasks');
      // Refresh tasks and resources after scheduling
      store.fetchTasks();
      store.fetchResources();
    });

    // ML status events
    this.socket.on('ml:status', (data) => {
      devLog('🤖 ML Status:', data.available ? 'Available' : 'Unavailable');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
