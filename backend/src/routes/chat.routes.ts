import { Router, Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/chat/rooms:
 *   get:
 *     summary: Get all chat rooms for current user
 *     tags: [Chat]
 */
router.get('/rooms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const rooms = await chatService.getRooms(userId);
    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/chat/rooms/{roomId}/messages:
 *   get:
 *     summary: Get messages for a specific room
 *     tags: [Chat]
 */
router.get('/rooms/:roomId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { limit, cursor } = req.query;
    const messages = await chatService.getMessages(
      roomId, 
      limit ? parseInt(limit as string) : 50, 
      cursor as string
    );
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/chat/rooms/{roomId}/messages:
 *   post:
 *     summary: Send a message to a room
 *     tags: [Chat]
 */
router.post('/rooms/:roomId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { content, type } = req.body;
    const userId = (req as any).user.userId;
    const message = await chatService.sendMessage(roomId, userId, content, type);
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/chat/rooms:
 *   post:
 *     summary: Create a new chat room
 *     tags: [Chat]
 */
router.post('/rooms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberIds, name, type } = req.body;
    const userId = (req as any).user.userId;
    const room = await chatService.createRoom(userId, memberIds, name, type);
    res.json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
});

export default router;
