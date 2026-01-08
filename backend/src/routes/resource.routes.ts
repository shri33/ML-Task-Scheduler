import { Router, Request, Response, NextFunction } from 'express';
import { resourceService } from '../services/resource.service';
import { createResourceSchema, updateResourceSchema } from '../validators/resource.validator';
import { AppError } from '../middleware/errorHandler';

type ResourceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

const router = Router();

// GET /api/resources - List all resources
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as ResourceStatus | undefined;
    const resources = await resourceService.findAll(status);
    res.json({ success: true, data: resources });
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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

// PATCH /api/resources/:id/load - Update resource load
router.patch('/:id/load', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { load } = req.body;
    if (typeof load !== 'number' || load < 0 || load > 100) {
      throw new AppError('Load must be a number between 0 and 100', 400);
    }
    
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
