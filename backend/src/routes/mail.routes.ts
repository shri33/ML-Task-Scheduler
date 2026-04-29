import { Router, Request, Response, NextFunction } from 'express';
import { mailService } from '../services/mail.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/mail/inbox:
 *   get:
 *     summary: Get user inbox
 *     tags: [Mail]
 */
router.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const mails = await mailService.getInbox(userId);
    res.json({ success: true, data: mails });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/mail/sent:
 *   get:
 *     summary: Get sent mails
 *     tags: [Mail]
 */
router.get('/sent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const mails = await mailService.getSent(userId);
    res.json({ success: true, data: mails });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/mail/send:
 *   post:
 *     summary: Send a new mail
 *     tags: [Mail]
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recipients, subject, content } = req.body;
    const userId = (req as any).user.userId;
    const mail = await mailService.sendMail(userId, recipients, subject, content);
    res.status(201).json({ success: true, data: mail });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/mail/{id}/read:
 *   patch:
 *     summary: Mark mail as read/unread
 *     tags: [Mail]
 */
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isRead } = req.body;
    const userId = (req as any).user.userId;
    await mailService.markRead(userId, req.params.id, isRead);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
