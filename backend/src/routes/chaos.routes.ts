import { Router, Request, Response, NextFunction } from 'express';
import { chaosService, FailureType } from '../services/chaos.service';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// Chaos management is restricted to admins
router.use(authenticate, adminOnly);

/**
 * @swagger
 * /api/v1/chaos/experiments:
 *   get:
 *     summary: List active chaos experiments
 *     tags: [Chaos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active experiments
 */
router.get('/experiments', (req: Request, res: Response) => {
  res.json({ success: true, data: chaosService.getExperiments() });
});

/**
 * @swagger
 * /api/v1/chaos/start:
 *   post:
 *     summary: Start a chaos experiment
 *     tags: [Chaos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service, type]
 *             properties:
 *               service:
 *                 type: string
 *               type:
 *                 type: string
 *               value:
 *                 type: number
 *     responses:
 *       200:
 *         description: Experiment initiated
 */
router.post('/start', (req: Request, res: Response) => {
  const { service, type, value } = req.body;
  
  if (!service || !type) {
    return res.status(400).json({ success: false, error: 'Service and type are required' });
  }

  chaosService.startExperiment({
    service,
    type: type as FailureType,
    value: value || 0,
    active: true,
    startTime: new Date()
  });

  res.json({ success: true, message: 'Chaos experiment initiated' });
});

/**
 * @swagger
 * /api/v1/chaos/stop:
 *   post:
 *     summary: Stop a chaos experiment
 *     tags: [Chaos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service, type]
 *             properties:
 *               service:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Experiment stopped
 */
router.post('/stop', (req: Request, res: Response) => {
  const { service, type } = req.body;
  
  if (!service || !type) {
    return res.status(400).json({ success: false, error: 'Service and type are required' });
  }

  chaosService.stopExperiment(service, type as FailureType);
  res.json({ success: true, message: 'Chaos experiment stopped' });
});

/**
 * POST /api/v1/chaos/stop-all
 * Stop all experiments
 */
router.post('/stop-all', (req: Request, res: Response) => {
  chaosService.stopAll();
  res.json({ success: true, message: 'All chaos experiments stopped' });
});

export default router;
