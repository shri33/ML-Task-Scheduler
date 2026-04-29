import prisma from '../lib/prisma';
import { CreateResourceInput, UpdateResourceInput } from '../validators/resource.validator';
import { mlService } from './ml.service';
import redisService from '../lib/redis';
import logger from '../lib/logger';

type ResourceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

interface ResourceWithLoad {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: string;
  layer: 'FOG' | 'CLOUD' | 'TERMINAL';
  createdAt: Date;
  updatedAt: Date;
}

export class ResourceService {
  async create(data: CreateResourceInput) {
    const resource = await prisma.resource.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        layer: (data as any).layer || 'FOG'
      }
    });
    await mlService.clearAllPredictions();
    await redisService.delByPattern('resources:*');
    return resource;
  }

  async findAll(status?: ResourceStatus, options?: { page?: number; limit?: number }) {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const cacheKey = `resources:all:${status || 'any'}:${page}:${limit}`;
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    const where = status ? { status } : undefined;

    const [items, total] = await Promise.all([
      prisma.resource.findMany({
        where,
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
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.resource.count({ where })
    ]);

    const result = { items, total, page, limit };
    await redisService.setJSON(cacheKey, result, 300);
    return result;
  }

  async findById(id: string) {
    const cacheKey = `resources:id:${id}`;
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    const resource = await prisma.resource.findUnique({
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

    if (resource) {
      await redisService.setJSON(cacheKey, resource, 300);
    }
    return resource;
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
    const resource = await prisma.resource.update({
      where: { id },
      data
    });
    await mlService.clearAllPredictions();
    await redisService.delByPattern('resources:*');
    return resource;
  }

  async delete(id: string) {
    // First unassign all tasks
    await prisma.task.updateMany({
      where: { resourceId: id },
      data: { resourceId: null, status: 'PENDING' }
    });

    // Delete schedule history
    await prisma.scheduleHistory.deleteMany({ where: { resourceId: id } });

    const resource = await prisma.resource.delete({
      where: { id }
    });
    await redisService.delByPattern('resources:*');
    await redisService.delByPattern('tasks:*'); // tasks were updated
    return resource;
  }

  async updateLoad(id: string, load: number) {
    const status = load >= 100 ? 'BUSY' : 'AVAILABLE';
    
    const resource = await prisma.resource.update({
      where: { id },
      data: {
        currentLoad: Math.min(100, Math.max(0, load)),
        status
      }
    });
    await mlService.clearAllPredictions();
    await redisService.delByPattern('resources:*');
    return resource;
  }

  /**
   * Decrement currentLoad by `delta` without a read-modify-write race.
   * Uses a DB-level expression: MAX(0, currentLoad - delta).
   * Updates status back to AVAILABLE if load drops below 100.
   */
  async decrementLoad(id: string, delta: number): Promise<void> {
    // Prisma doesn't expose MAX() in updateMany directly, so we use $executeRaw.
    await prisma.$executeRaw`
      UPDATE "Resource"
      SET
        "currentLoad" = GREATEST(0, "currentLoad" - ${delta}),
        "status"      = CASE
                          WHEN GREATEST(0, "currentLoad" - ${delta}) >= 100 THEN 'BUSY'::"ResourceStatus"
                          ELSE 'AVAILABLE'::"ResourceStatus"
                        END,
        "updatedAt"   = NOW()
      WHERE id = ${id}
    `;
    // Invalidate ML prediction cache since load changed
    await mlService.clearAllPredictions();
    await redisService.delByPattern('resources:*');
  }


  async getStats() {
    const cacheKey = 'resources:stats';
    const cached = await redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    const resources = await prisma.resource.findMany() as ResourceWithLoad[];
    
    const total = resources.length;
    const available = resources.filter((r: ResourceWithLoad) => r.status === 'AVAILABLE').length;
    const busy = resources.filter((r: ResourceWithLoad) => r.status === 'BUSY').length;
    const offline = resources.filter((r: ResourceWithLoad) => r.status === 'OFFLINE').length;
    
    // Distribution by layer
    const distribution = {
      FOG: resources.filter((r: ResourceWithLoad) => r.layer === 'FOG').length,
      CLOUD: resources.filter((r: ResourceWithLoad) => r.layer === 'CLOUD').length,
      TERMINAL: resources.filter((r: ResourceWithLoad) => r.layer === 'TERMINAL').length,
    };

    const avgLoad = resources.length > 0 
      ? resources.reduce((sum: number, r: ResourceWithLoad) => sum + r.currentLoad, 0) / resources.length 
      : 0;

    const result = { total, available, busy, offline, avgLoad: Math.round(avgLoad * 100) / 100, distribution };
    await redisService.setJSON(cacheKey, result, 60);
    return result;
  }
}

export const resourceService = new ResourceService();
