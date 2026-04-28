import prisma from '../lib/prisma';
import logger from '../lib/logger';

export interface AuditEntry {
  userId?: string;
  action: string;
  target?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}

export class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          target: entry.target,
          metadata: entry.metadata,
          ip: entry.ip,
          userAgent: entry.userAgent,
        }
      });
    } catch (error) {
      // Don't let audit logging failure crash the request
      logger.error('Failed to write audit log', { entry, error: String(error) });
    }
  }

  // Helper for common actions
  async logAuth(userId: string, action: 'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE', ip?: string, userAgent?: string) {
    return this.log({ userId, action, ip, userAgent });
  }

  async logTask(userId: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE', taskId: string, metadata?: any) {
    return this.log({ userId, action: `TASK_${action}`, target: taskId, metadata });
  }
}

export const auditService = new AuditService();
export default auditService;
