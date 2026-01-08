import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface WebSocketState {
  isConnected: boolean;
  lastMessage: any;
  error: Error | null;
}

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
  });

  const { fetchTasks, fetchResources, fetchMetrics } = useStore();

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return;

    const token = localStorage.getItem('token');
    
    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket error:', error);
      setState((prev) => ({ ...prev, error }));
    });

    // Task events
    socket.on('task:created', (task) => {
      console.log('📥 Task created:', task);
      setState((prev) => ({ ...prev, lastMessage: { type: 'task:created', data: task } }));
      fetchTasks();
    });

    socket.on('task:updated', (task) => {
      console.log('📥 Task updated:', task);
      setState((prev) => ({ ...prev, lastMessage: { type: 'task:updated', data: task } }));
      fetchTasks();
    });

    socket.on('task:deleted', (data) => {
      console.log('📥 Task deleted:', data);
      setState((prev) => ({ ...prev, lastMessage: { type: 'task:deleted', data } }));
      fetchTasks();
    });

    socket.on('tasks:scheduled', (results) => {
      console.log('📥 Tasks scheduled:', results);
      setState((prev) => ({ ...prev, lastMessage: { type: 'tasks:scheduled', data: results } }));
      fetchTasks();
      fetchResources();
    });

    socket.on('tasks:updated', () => {
      fetchTasks();
      fetchMetrics();
    });

    // Resource events
    socket.on('resource:created', (resource) => {
      console.log('📥 Resource created:', resource);
      setState((prev) => ({ ...prev, lastMessage: { type: 'resource:created', data: resource } }));
      fetchResources();
    });

    socket.on('resource:updated', (resource) => {
      console.log('📥 Resource updated:', resource);
      setState((prev) => ({ ...prev, lastMessage: { type: 'resource:updated', data: resource } }));
      fetchResources();
    });

    socket.on('resource:deleted', (data) => {
      console.log('📥 Resource deleted:', data);
      setState((prev) => ({ ...prev, lastMessage: { type: 'resource:deleted', data } }));
      fetchResources();
    });

    socket.on('resources:updated', () => {
      fetchResources();
    });

    // Fog computing events
    socket.on('fog:algorithm:started', (data) => {
      console.log('📥 Fog algorithm started:', data);
      setState((prev) => ({ ...prev, lastMessage: { type: 'fog:algorithm:started', data } }));
    });

    socket.on('fog:algorithm:progress', (data) => {
      console.log('📥 Fog algorithm progress:', data);
      setState((prev) => ({ ...prev, lastMessage: { type: 'fog:algorithm:progress', data } }));
    });

    socket.on('fog:algorithm:completed', (data) => {
      console.log('📥 Fog algorithm completed:', data);
      setState((prev) => ({ ...prev, lastMessage: { type: 'fog:algorithm:completed', data } }));
    });

    // Notifications
    socket.on('notification', (notification) => {
      console.log('📥 Notification:', notification);
      setState((prev) => ({ ...prev, lastMessage: { type: 'notification', data: notification } }));
    });

    // Ping/pong for connection health
    socket.on('pong', () => {
      console.log('🏓 Pong received');
    });

    return () => {
      socket.disconnect();
    };
  }, [autoConnect, reconnection, reconnectionAttempts, reconnectionDelay, fetchTasks, fetchResources, fetchMetrics]);

  // Join a room
  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit(`join:${room}`);
  }, []);

  // Leave a room
  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit(`leave:${room}`);
  }, []);

  // Send a custom event
  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  // Ping the server
  const ping = useCallback(() => {
    socketRef.current?.emit('ping');
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  // Reconnect
  const reconnect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  return {
    ...state,
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
    emit,
    ping,
    disconnect,
    reconnect,
  };
};

export default useWebSocket;
