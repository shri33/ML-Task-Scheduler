import { Socket } from 'socket.io';
import logger from './logger';
import prisma from './prisma';

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    email: string;
  };
}

export function handleSocketEvents(socket: AuthenticatedSocket) {
  const userId = socket.user?.userId;
  if (!userId) return;

  logger.info('Authenticated client connected', { socketId: socket.id, userId });

  // Presence logic: Broadcast that user is online
  socket.broadcast.emit('user:online', { userId });

  // Handle typing indicator
  socket.on('chat:typing_start', (data: { roomId: string }) => {
    socket.to(`room:${data.roomId}`).emit('chat:typing_start', { userId, roomId: data.roomId });
  });

  socket.on('chat:typing_stop', (data: { roomId: string }) => {
    socket.to(`room:${data.roomId}`).emit('chat:typing_stop', { userId, roomId: data.roomId });
  });

  // Handle joining specific chat rooms for targeted broadcasts
  socket.on('chat:join_room', (data: { roomId: string }) => {
    socket.join(`room:${data.roomId}`);
    logger.debug('User joined chat room', { userId, roomId: data.roomId });
  });

  socket.on('chat:leave_room', (data: { roomId: string }) => {
    socket.leave(`room:${data.roomId}`);
    logger.debug('User left chat room', { userId, roomId: data.roomId });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id, userId });
    // Broadcast that user is offline
    socket.broadcast.emit('user:offline', { userId });
  });
}
