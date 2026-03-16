import { Router } from 'express';
import { gpuRegistryService, GPUNode } from '../services/gpuRegistry.service';
import logger from '../lib/logger';

const router = Router();

// Endpoint for GPU worker nodes to report telemetry
router.post('/register', async (req, res) => {
  try {
    const { id, host, gpuType, vramTotal, vramUsed, utilization, queue } = req.body;

    if (!id || !host || !gpuType || vramTotal === undefined || vramUsed === undefined || utilization === undefined) {
      return res.status(400).json({ error: 'Missing required telemetry fields' });
    }

    const node: GPUNode = {
      id,
      host,
      gpuType,
      vramTotal: Number(vramTotal),
      vramUsed: Number(vramUsed),
      utilization: Number(utilization),
      queue: Number(queue) || 0,
      lastHeartbeat: Date.now()
    };

    await gpuRegistryService.registerNode(node);
    return res.status(200).json({ success: true, message: `Node ${id} registered` });
  } catch (error) {
    logger.error('Error in GPU registration route', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Endpoint to view the current cluster state (useful for dashboard)
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await gpuRegistryService.getAllNodes();
    return res.status(200).json({
      success: true,
      count: nodes.length,
      nodes
    });
  } catch (error) {
    logger.error('Error fetching GPU nodes', error);
    return res.status(500).json({ error: 'Internal server error while fetching nodes' });
  }
});

export default router;
