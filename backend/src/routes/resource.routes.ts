import { Router, Request, Response, NextFunction } from 'express';
import { resourceService } from '../services/resource.service';
import { createResourceSchema, updateResourceSchema } from '../validators/resource.validator';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validateUUID, sanitizeBody } from '../middleware/validate.middleware';

type ResourceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

const router = Router();

// All resource routes require authentication
router.use(authenticate);

// Sanitize incoming body content
router.use(sanitizeBody);

// GET /api/resources - List all resources
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as ResourceStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await resourceService.findAll(status, { page, limit });
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/resources/stats - Get resource statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await resourceService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/resources/:id - Get resource by ID
router.get('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resource = await resourceService.findById(req.params.id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

// POST /api/resources - Create new resource
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createResourceSchema.parse(req.body);
    const resource = await resourceService.create(data);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('resource:created', resource);
    
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

// PUT /api/resources/:id - Update resource
router.put('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateResourceSchema.parse(req.body);
    const resource = await resourceService.update(req.params.id, data);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('resource:updated', resource);
    
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/resources/:id - Delete resource
router.delete('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await resourceService.delete(req.params.id);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('resource:deleted', { id: req.params.id });
    
    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    next(error);
  }
});

const updateLoadSchema = z.object({
  load: z.number().min(0, 'Load cannot be negative').max(100, 'Load cannot exceed 100')
});

// PATCH /api/resources/:id/load - Update resource load
router.patch('/:id/load', validateUUID('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = updateLoadSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(validation.error.errors[0].message, 400);
    }
    
    const { load } = validation.data;
    
    const resource = await resourceService.updateLoad(req.params.id, load);
    
    // Emit socket event
    const io = req.app.get('io');
    io?.emit('resource:updated', resource);
    
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

export default router;
