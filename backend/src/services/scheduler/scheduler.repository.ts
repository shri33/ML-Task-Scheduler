import prisma from '../../lib/prisma';
import { Task, Resource } from './scheduler.types';

export class SchedulerRepository {
  async findPending(limit = 100): Promise<Task[]> {
    // Phase 3 optimization: Add take limits to findMany calls
    const dbTasks = await prisma.task.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit
    });
    
    // Map db tasks to our scheduler Task interface
    return dbTasks.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      size: t.size,
      priority: t.priority,
      status: t.status,
      predictedTime: t.predictedTime,
      actualTime: t.actualTime,
      resourceId: t.resourceId,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      scheduledAt: t.scheduledAt,
      completedAt: t.completedAt
    }));
  }

  async findAvailableResources(): Promise<Resource[]> {
    const dbResources = await prisma.resource.findMany({
      where: { status: 'AVAILABLE' }
    });

    return dbResources.map(r => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      currentLoad: r.currentLoad,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  async assignToResource(taskId: string, resourceId: string, predictedTime: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Idempotency check: check if task is already assigned to a resource
      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: { status: true, resourceId: true }
      });

      if (!task || task.status !== 'PENDING' || task.resourceId) {
        // Skip already assigned/scheduled tasks
        return;
      }

      await tx.task.update({
        where: { id: taskId },
        data: {
          resourceId,
          status: 'SCHEDULED',
          predictedTime,
          scheduledAt: new Date()
        }
      });
    });
  }

  async updateLoad(resourceId: string, load: number): Promise<void> {
    await prisma.resource.update({
      where: { id: resourceId },
      data: { currentLoad: load }
    });
  }

  async recordHistory(
    taskId: string,
    resourceId: string,
    algorithm: string,
    mlEnabled: boolean,
    predictedTime: number,
    score: number,
    explanation: string
  ): Promise<void> {
    await prisma.scheduleHistory.create({
      data: {
        taskId,
        resourceId,
        algorithm,
        mlEnabled,
        predictedTime,
        score,
        explanation
      }
    });
  }

  async getHistory(limit = 50) {
    return prisma.scheduleHistory.findMany({
      include: {
        task: {
          select: { id: true, name: true, type: true, size: true, priority: true }
        },
        resource: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async getComparison() {
    const history = await prisma.scheduleHistory.findMany({
      where: { actualTime: { not: null } },
      select: {
        mlEnabled: true,
        predictedTime: true,
        actualTime: true
      }
    });

    const withML = history.filter(h => h.mlEnabled);
    const withoutML = history.filter(h => !h.mlEnabled);

    const calcStats = (items: any[]) => {
      if (items.length === 0) return { count: 0, avgError: 0, avgTime: 0 };
      
      const avgError = items.reduce((sum: number, h: any) => {
        return sum + Math.abs((h.predictedTime || 0) - (h.actualTime || 0));
      }, 0) / items.length;

      const avgTime = items.reduce((sum: number, h: any) => sum + (h.actualTime || 0), 0) / items.length;

      return {
        count: items.length,
        avgError: Math.round(avgError * 100) / 100,
        avgTime: Math.round(avgTime * 100) / 100
      };
    };

    return {
      withML: calcStats(withML),
      withoutML: calcStats(withoutML)
    };
  }
}

export const schedulerRepository = new SchedulerRepository();
