import { Server } from 'socket.io';
import logger from './logger';

let io: Server | null = null;

/**
 * Initialize the global IO instance
 */
export const setIo = (instance: Server) => {
  io = instance;
  logger.info('Global Socket.IO instance initialized');
};

/**
 * Get the global IO instance
 */
export const getIo = () => io;

/**
 * Emit an event to a specific user's room
 */
export const emitToUser = (userId: string | null | undefined, event: string, data: any) => {
  if (!io) return;
  
  if (userId) {
    io.to(`user:${userId}`).emit(event, data);
  } else {
    // If no userId, broadcast to all (or handle as anonymous)
    io.emit(event, data);
  }
};

/**
 * Broadcast an event to all connected clients
 */
export const emitToAll = (event: string, data: any) => {
  if (!io) return;
  io.emit(event, data);
};
