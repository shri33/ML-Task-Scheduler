import prisma from '../lib/prisma';
import { CreateTaskInput, UpdateTaskInput } from '../validators/task.validator';
import { mlService } from './ml.service';
import { emailService } from './email.service';
import logger from '../lib/logger';
import redisService from '../lib/redis';

type TaskStatus = 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export class TaskService {
  async create(data: CreateTaskInput, userId?: string) {
    const task = await prisma.task.create({
      data: {
        name: data.name,
        type: data.type,
        size: data.size,
        priority: data.priority,
        userId: userId?.startsWith('demo-') ? null : userId,
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
      }
    });
    await mlService.clearAllPredictions();
    await redisService.delByPattern('tasks:*');
    return task;
  }

  async findAll(status?: TaskStatus, options?: { page?: number; limit?: number }, userId?: string) {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const cacheKey = `tasks:all:${status || 'any'}:${userId || 'anon'}:${page}:${limit}`;
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) {
      logger.info(`Task Cache Hit: ${cacheKey}`);
      return cached;
    }

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      userId: userId?.startsWith('demo-') ? null : userId
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          resource: {
            select: {
              id: true,
              name: true,
              currentLoad: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.task.count({ where })
    ]);

    const result = { items, total, page, limit };
    await redisService.setJSON(cacheKey, result, 300); // 5 min cache
    return result;
  }

  async findById(id: string) {
    const cacheKey = `tasks:id:${id}`;
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        resource: true,
        predictions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        scheduleHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (task) {
      await redisService.setJSON(cacheKey, task, 300);
    }
    return task;
  }

  async findPending(userId?: string) {
    return prisma.task.findMany({
      where: {
        status: 'PENDING',
        deletedAt: null,
        userId: userId?.startsWith('demo-') ? null : userId
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async update(id: string, data: UpdateTaskInput) {
    const task = await prisma.task.update({
      where: { id },
      data
    });
    await mlService.clearAllPredictions();
    await redisService.delByPattern('tasks:*');
    return task;
  }

  async delete(id: string) {
    // Soft delete — set deletedAt timestamp instead of removing the record
    const task = await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    await redisService.delByPattern('tasks:*');
    return task;
  }

  async bulkCreate(tasks: CreateTaskInput[], userId?: string) {
    const created = await prisma.$transaction(
      tasks.map(data =>
        prisma.task.create({
          data: {
            name: data.name,
            type: data.type,
            size: data.size,
            priority: data.priority,
            userId,
            ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
          }
        })
      )
    );
    await redisService.delByPattern('tasks:*');
    return created;
  }

  async assignToResource(taskId: string, resourceId: string, predictedTime?: number) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        resourceId,
        status: 'SCHEDULED',
        predictedTime,
        scheduledAt: new Date()
      }
    });
    await redisService.delByPattern('tasks:*');
    return task;
  }

  async markCompleted(taskId: string, actualTime: number) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        actualTime,
        completedAt: new Date()
      },
      include: { resource: true }
    });

    await redisService.delByPattern('tasks:*');

    // Check for performance anomaly (if we have a prediction)
    if (task.predictedTime) {
      const deviation = Math.abs(task.actualTime! - task.predictedTime);
      const threshold = task.predictedTime * 0.5; // 50% deviation threshold for alert

      if (deviation > threshold) {
        logger.warn(`Anomaly detected for task ${task.id}: Actual=${task.actualTime}s, Predicted=${task.predictedTime}s`);
        // Trigger async notification
        emailService.notifyAnomaly(task, task.actualTime!, task.predictedTime).catch(e => 
          logger.error('Failed to send anomaly notification', e)
        );
      }
    }

    return task;
  }

  async getStats() {
    const cacheKey = 'tasks:stats';
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    const notDeleted = { deletedAt: null };
    const groups = await prisma.task.groupBy({
      by: ['status'],
      where: notDeleted,
      _count: { status: true },
    });

    const result = { total: 0, pending: 0, scheduled: 0, running: 0, completed: 0, failed: 0 };
    for (const g of groups) {
      const count = g._count.status;
      result.total += count;
      const key = g.status.toLowerCase() as keyof typeof result;
      if (key in result) (result as any)[key] = count;
    }
    await redisService.setJSON(cacheKey, result, 60); // 1 min cache for stats
    return result;
  }
}

export const taskService = new TaskService();
