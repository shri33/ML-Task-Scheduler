import prisma from '../lib/prisma';
import { CreateTaskInput, UpdateTaskInput } from '../validators/task.validator';

type TaskStatus = 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export class TaskService {
  async create(data: CreateTaskInput) {
    return prisma.task.create({
      data: {
        name: data.name,
        type: data.type,
        size: data.size,
        priority: data.priority,
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
      }
    });
  }

  async findAll(status?: TaskStatus, options?: { page?: number; limit?: number }) {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status ? { status } : {})
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

    return { items, total, page, limit };
  }

  async findById(id: string) {
    return prisma.task.findUnique({
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
  }

  async findPending() {
    return prisma.task.findMany({
      where: { status: 'PENDING' },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async update(id: string, data: UpdateTaskInput) {
    return prisma.task.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    // Soft delete — set deletedAt timestamp instead of removing the record
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async bulkCreate(tasks: CreateTaskInput[]) {
    const created = await prisma.$transaction(
      tasks.map(data =>
        prisma.task.create({
          data: {
            name: data.name,
            type: data.type,
            size: data.size,
            priority: data.priority,
            ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
          }
        })
      )
    );
    return created;
  }

  async assignToResource(taskId: string, resourceId: string, predictedTime?: number) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        resourceId,
        status: 'SCHEDULED',
        predictedTime,
        scheduledAt: new Date()
      }
    });
  }

  async markCompleted(taskId: string, actualTime: number) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        actualTime,
        completedAt: new Date()
      }
    });
  }

  async getStats() {
    const notDeleted = { deletedAt: null };
    const [total, pending, scheduled, running, completed, failed] = await Promise.all([
      prisma.task.count({ where: notDeleted }),
      prisma.task.count({ where: { ...notDeleted, status: 'PENDING' } }),
      prisma.task.count({ where: { ...notDeleted, status: 'SCHEDULED' } }),
      prisma.task.count({ where: { ...notDeleted, status: 'RUNNING' } }),
      prisma.task.count({ where: { ...notDeleted, status: 'COMPLETED' } }),
      prisma.task.count({ where: { ...notDeleted, status: 'FAILED' } })
    ]);

    return { total, pending, scheduled, running, completed, failed };
  }
}

export const taskService = new TaskService();
