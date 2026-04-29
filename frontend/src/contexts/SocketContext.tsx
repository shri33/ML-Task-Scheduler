import React, { createContext, useContext, useEffect } from 'react';
import { socketService } from '../lib/socket';
import { useStore } from '../store';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext<any>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    // Only connect if authenticated
    if (user) {
      const socket = socketService.connect();

      if (socket) {
        const { fetchTasks, fetchResources, fetchMetrics, fetchNotifications, fetchMlData } = useStore.getState();

        // Task events
        socket.on('task:created', (task) => {
          toast.success('Task Created', `New task "${task.name}" has been added.`);
          fetchTasks();
          fetchMetrics();
        });

        socket.on('task:updated', (_task) => {
          fetchTasks();
        });

        socket.on('task:scheduled', (task) => {
          toast.info('Task Scheduled', `Task "${task.name}" is now being processed.`);
          fetchTasks();
          fetchResources();
        });

        socket.on('task:completed', (task) => {
          toast.success('Task Completed', `Task "${task.name}" has finished execution.`);
          fetchTasks();
          fetchResources();
          fetchMetrics();
          fetchNotifications();
        });

        socket.on('task:failed', (task) => {
          toast.error('Task Failed', `Task "${task.name}" encountered an error.`);
          fetchTasks();
          fetchResources();
        });

        // Resource events
        socket.on('resource:load_updated', () => {
          fetchResources();
        });

        // Global stats
        socket.on('stats:updated', () => {
          fetchMetrics();
        });

        // Notifications
        socket.on('notification:new', (notification) => {
          toast.info(notification.title, notification.message);
          fetchNotifications();
        });

        // ML Model events
        socket.on('model:retraining_started', () => {
          toast.info('Retraining Started', 'ML model retraining process has been initiated.');
          fetchMlData();
        });

        socket.on('model:retrained', (data) => {
          toast.success('Model Retrained', `New model version ${data.version} is now active.`);
          fetchMlData();
          fetchMetrics();
        });

        socket.on('model:data_accumulated', () => {
          fetchMlData();
        });

        socket.on('model:config_updated', () => {
          fetchMlData();
        });
        
        socket.on('system:health_updated', (data) => {
          if (data.state === 'open') {
            toast.error('System Alert', `Service "${data.service}" is currently down.`);
          } else if (data.state === 'closed') {
            toast.success('System Restored', `Service "${data.service}" is back online.`);
          }
        });
      }
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketService.getSocket() }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
