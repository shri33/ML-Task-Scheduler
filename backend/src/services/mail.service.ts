import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { emitToUser } from '../lib/socket';

export class MailService {
  /**
   * Get inbox for a user
   */
  async getInbox(userId: string) {
    return prisma.mailMessage.findMany({
      where: {
        thread: {
          participants: { some: { userId } }
        },
        senderId: { not: userId }
      },
      include: {
        sender: { select: { name: true, email: true } },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get sent mails for a user
   */
  async getSent(userId: string) {
    return prisma.mailMessage.findMany({
      where: { senderId: userId },
      include: {
        sender: { select: { name: true, email: true } },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Send a new mail
   */
  async sendMail(senderId: string, recipients: string[], subject: string, content: string) {
    // 1. Create thread
    const thread = await prisma.mailThread.create({
      data: {
        subject,
        participants: {
          create: [
            { userId: senderId },
            ...recipients.map(id => ({ userId: id }))
          ]
        }
      }
    });

    // 2. Create message
    const message = await prisma.mailMessage.create({
      data: {
        threadId: thread.id,
        senderId,
        subject,
        content
      },
      include: {
        sender: { select: { name: true, email: true } }
      }
    });

    // 3. Create recipients status
    await prisma.mailRecipient.createMany({
      data: recipients.map(id => ({
        mailId: message.id,
        userId: id
      }))
    });

    // Notify recipients
    recipients.forEach(id => {
      emitToUser(id, 'mail:received', message);
    });

    return message;
  }

  /**
   * Mark as read
   */
  async markRead(userId: string, mailId: string, isRead: boolean) {
    return prisma.mailRecipient.updateMany({
      where: {
        mailId,
        userId
      },
      data: {
        isRead,
        readAt: isRead ? new Date() : null
      }
    });
  }
}

export const mailService = new MailService();
