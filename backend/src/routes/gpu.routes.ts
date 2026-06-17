import { Router, Request, Response, NextFunction } from 'express';
import { gpuRegistryService, GPUNode } from '../services/gpuRegistry.service';
import { validateRequest } from '../middleware/validate';
import { gpuRegistrationSchema } from '../validators/gpu.validator';
import { successResponse } from '../lib/http/response';
import logger from '../lib/logger';

const router = Router();

// Endpoint for GPU worker nodes to report telemetry
router.post('/register', validateRequest({ body: gpuRegistrationSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, host, gpuType, vramTotal, vramUsed, utilization, queue } = req.body;

    const node: GPUNode = {
      id,
      host,
      gpuType,
      vramTotal,
      vramUsed,
      utilization,
      queue,
      lastHeartbeat: Date.now()
    };

    await gpuRegistryService.registerNode(node);
    successResponse(res, { message: `Node ${id} registered` });
  } catch (error) {
    logger.error('Error in GPU registration route', error);
    next(error);
  }
});

// Endpoint to view the current cluster state (useful for dashboard)
router.get('/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodes = await gpuRegistryService.getAllNodes();
    successResponse(res, nodes);
  } catch (error) {
    logger.error('Error fetching GPU nodes', error);
    next(error);
  }
});

export default router;
