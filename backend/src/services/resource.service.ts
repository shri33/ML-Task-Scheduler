import prisma from '../lib/prisma';
import { CreateResourceInput, UpdateResourceInput } from '../validators/resource.validator';

type ResourceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

interface ResourceWithLoad {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ResourceService {
  async create(data: CreateResourceInput) {
    return prisma.resource.create({
      data: {
        name: data.name,
        capacity: data.capacity
      }
    });
  }

  async findAll(status?: ResourceStatus) {
    return prisma.resource.findMany({
      where: status ? { status } : undefined,
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                status: { in: ['SCHEDULED', 'RUNNING'] }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string) {
    return prisma.resource.findUnique({
      where: { id },
      include: {
        tasks: {
          where: {
            status: { in: ['SCHEDULED', 'RUNNING'] }
          },
          orderBy: { scheduledAt: 'asc' }
        }
      }
    });
  }

  async findAvailable() {
    return prisma.resource.findMany({
      where: {
        status: 'AVAILABLE',
        currentLoad: { lt: 100 }
      },
      orderBy: { currentLoad: 'asc' }
    });
  }

  async update(id: string, data: UpdateResourceInput) {
    return prisma.resource.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    // First unassign all tasks
    await prisma.task.updateMany({
      where: { resourceId: id },
      data: { resourceId: null, status: 'PENDING' }
    });

    // Delete schedule history
    await prisma.scheduleHistory.deleteMany({ where: { resourceId: id } });

    return prisma.resource.delete({
      where: { id }
    });
  }

  async updateLoad(id: string, load: number) {
    const status = load >= 100 ? 'BUSY' : 'AVAILABLE';
    
    return prisma.resource.update({
      where: { id },
      data: {
        currentLoad: Math.min(100, Math.max(0, load)),
        status
      }
    });
  }

  async getStats() {
    const resources = await prisma.resource.findMany() as ResourceWithLoad[];
    
    const total = resources.length;
    const available = resources.filter((r: ResourceWithLoad) => r.status === 'AVAILABLE').length;
    const busy = resources.filter((r: ResourceWithLoad) => r.status === 'BUSY').length;
    const offline = resources.filter((r: ResourceWithLoad) => r.status === 'OFFLINE').length;
    const avgLoad = resources.length > 0 
      ? resources.reduce((sum: number, r: ResourceWithLoad) => sum + r.currentLoad, 0) / resources.length 
      : 0;

    return { total, available, busy, offline, avgLoad: Math.round(avgLoad * 100) / 100 };
  }
}

export const resourceService = new ResourceService();
