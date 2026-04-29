import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { emitToUser, emitToAll } from '../lib/socket';

export class ChatService {
  /**
   * Get all chat rooms for a user
   */
  async getRooms(userId: string) {
    return prisma.chatRoom.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
  }

  /**
   * Get messages for a specific room
   */
  async getMessages(roomId: string, limit = 50, cursor?: string) {
    return prisma.chatMessage.findMany({
      where: { roomId },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
  }

  /**
   * Send a message to a room
   */
  async sendMessage(roomId: string, senderId: string, content: string, type = 'TEXT') {
    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          roomId,
          senderId,
          content,
          type
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await tx.chatRoom.update({
        where: { id: roomId },
        data: { lastMessageAt: new Date() }
      });

      return msg;
    });

    // Notify all members of the room
    const members = await prisma.chatMember.findMany({
      where: { roomId }
    });

    members.forEach(member => {
      emitToUser(member.userId, 'chat:message_received', message);
    });

    return message;
  }

  /**
   * Create a new chat room (Direct or Group)
   */
  async createRoom(creatorId: string, memberIds: string[], name?: string, type: 'DIRECT' | 'GROUP' = 'DIRECT') {
    // For DIRECT chats, check if it already exists
    if (type === 'DIRECT' && memberIds.length === 1) {
      const otherUserId = memberIds[0];
      const existing = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: creatorId } } },
            { members: { some: { userId: otherUserId } } }
          ]
        },
        include: {
          members: true
        }
      });
      if (existing) return existing;
    }

    const room = await prisma.chatRoom.create({
      data: {
        name,
        type,
        members: {
          create: [
            { userId: creatorId, isAdmin: true },
            ...memberIds.map(id => ({ userId: id }))
          ]
        }
      },
      include: {
        members: true
      }
    });

    return room;
  }
}

export const chatService = new ChatService();
