import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Device type enum matching Prisma
const DeviceTypes = ['CAMERA', 'ROBOT_ARM', 'IOT_SENSOR', 'EDGE_SERVER', 'ACTUATOR'] as const;
const DeviceStatuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR'] as const;

// Validation schemas
const createDeviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(DeviceTypes),
  ipAddress: z.string().ip().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  capabilities: z.record(z.any()).optional(),
  configuration: z.record(z.any()).optional()
});

const updateDeviceSchema = createDeviceSchema.partial().extend({
  status: z.enum(DeviceStatuses).optional()
});

// Get all devices
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, status, search } = req.query;

    const where: any = {};
    
    if (type && DeviceTypes.includes(type as any)) {
      where.type = type;
    }
    
    if (status && DeviceStatuses.includes(status as any)) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const devices = await prisma.device.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deviceLogs: true, deviceMetrics: true }
        }
      }
    });

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    next(error);
  }
});

// Get device by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        deviceLogs: {
          orderBy: { timestamp: 'desc' },
          take: 50
        },
        deviceMetrics: {
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
});

// Create new device
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createDeviceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const device = await prisma.device.create({
      data: validation.data
    });

    // Log device creation
    await prisma.deviceLog.create({
      data: {
        deviceId: device.id,
        level: 'info',
        message: `Device "${device.name}" registered`,
        metadata: { action: 'created', type: device.type }
      }
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A device with this IP address and port already exists'
      });
    }
    next(error);
  }
});

// Update device
router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const validation = updateDeviceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const existingDevice = await prisma.device.findUnique({ where: { id } });
    if (!existingDevice) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...validation.data,
        updatedAt: new Date()
      }
    });

    // Log status changes
    if (validation.data.status && validation.data.status !== existingDevice.status) {
      await prisma.deviceLog.create({
        data: {
          deviceId: device.id,
          level: validation.data.status === 'ERROR' ? 'error' : 'info',
          message: `Status changed from ${existingDevice.status} to ${validation.data.status}`,
          metadata: { action: 'status_change', oldStatus: existingDevice.status, newStatus: validation.data.status }
        }
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
});

// Delete device
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    await prisma.device.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Device heartbeat endpoint
router.post('/:id/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metrics } = req.body;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Update heartbeat timestamp and set status to online
    await prisma.device.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        status: 'ONLINE'
      }
    });

    // Store metrics if provided
    if (metrics && Array.isArray(metrics)) {
      const metricRecords = metrics.map((m: any) => ({
        deviceId: id,
        metricName: m.name,
        value: m.value,
        unit: m.unit
      }));

      await prisma.deviceMetric.createMany({
        data: metricRecords
      });
    }

    res.json({
      success: true,
      message: 'Heartbeat received'
    });
  } catch (error) {
    next(error);
  }
});

// Get device metrics
router.get('/:id/metrics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metricName, from, to, limit = '100' } = req.query;

    const where: any = { deviceId: id };
    
    if (metricName) {
      where.metricName = metricName;
    }
    
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from as string);
      if (to) where.timestamp.lte = new Date(to as string);
    }

    const metrics = await prisma.deviceMetric.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

// Get device logs
router.get('/:id/logs', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { level, from, to, limit = '100' } = req.query;

    const where: any = { deviceId: id };
    
    if (level) {
      where.level = level;
    }
    
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from as string);
      if (to) where.timestamp.lte = new Date(to as string);
    }

    const logs = await prisma.deviceLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Send command to device
router.post('/:id/command', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { command, parameters } = req.body;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    if (device.status !== 'ONLINE') {
      return res.status(400).json({
        success: false,
        error: `Cannot send command to device with status: ${device.status}`
      });
    }

    // Log the command
    await prisma.deviceLog.create({
      data: {
        deviceId: id,
        level: 'info',
        message: `Command sent: ${command}`,
        metadata: { command, parameters, sentBy: req.user?.userId }
      }
    });

    // In a real implementation, this would send the command to the actual device
    // For now, we'll just acknowledge it
    res.json({
      success: true,
      message: `Command "${command}" sent to device "${device.name}"`,
      data: {
        deviceId: id,
        command,
        parameters,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get device statistics
router.get('/stats/overview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalDevices,
      onlineDevices,
      offlineDevices,
      errorDevices,
      devicesByType
    ] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ONLINE' } }),
      prisma.device.count({ where: { status: 'OFFLINE' } }),
      prisma.device.count({ where: { status: 'ERROR' } }),
      prisma.device.groupBy({
        by: ['type'],
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
        error: errorDevices,
        maintenance: totalDevices - onlineDevices - offlineDevices - errorDevices,
        byType: devicesByType.reduce((acc: Record<string, number>, item: { type: string; _count: number }) => {
          acc[item.type] = item._count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
