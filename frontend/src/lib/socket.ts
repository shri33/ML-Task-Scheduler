import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

// Get socket URL from env or use default
const getSocketUrl = (): string => {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (apiUrl) {
    return apiUrl.replace('/api', '');
  }
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();

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
      console.log('🔌 WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    // Task events
    this.socket.on('task:created', (task) => {
      console.log('📥 Task created:', task.name);
      store.addTask(task);
    });

    this.socket.on('task:updated', (task) => {
      console.log('📝 Task updated:', task.name);
      store.updateTask(task);
    });

    this.socket.on('task:deleted', (data) => {
      console.log('🗑️ Task deleted:', data.id);
      store.removeTask(data.id);
    });

    this.socket.on('task:scheduled', (task) => {
      console.log('📅 Task scheduled:', task.name);
      store.updateTask(task);
    });

    this.socket.on('task:completed', (task) => {
      console.log('✅ Task completed:', task.name);
      store.updateTask(task);
    });

    // Resource events
    this.socket.on('resource:created', (resource) => {
      console.log('📥 Resource created:', resource.name);
      store.addResource(resource);
    });

    this.socket.on('resource:updated', (resource) => {
      console.log('📝 Resource updated:', resource.name);
      store.updateResource(resource);
    });

    this.socket.on('resource:deleted', (data) => {
      console.log('🗑️ Resource deleted:', data.id);
      store.removeResource(data.id);
    });

    // Schedule events
    this.socket.on('schedule:completed', (data) => {
      console.log('🎯 Scheduling completed:', data.count, 'tasks');
      // Refresh tasks and resources after scheduling
      store.fetchTasks();
      store.fetchResources();
    });

    // ML status events
    this.socket.on('ml:status', (data) => {
      console.log('🤖 ML Status:', data.available ? 'Available' : 'Unavailable');
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
