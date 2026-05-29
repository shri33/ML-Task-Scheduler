import { Router, Request, Response, NextFunction } from 'express';
import { chaosService, FailureType } from '../services/chaos.service';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate';
import { startChaosSchema, stopChaosSchema } from '../validators/chaos.validator';
import { successResponse } from '../lib/http/response';

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
router.get('/experiments', (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, chaosService.getExperiments());
  } catch (error) {
    next(error);
  }
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
router.post('/start', validateRequest({ body: startChaosSchema }), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service, type, value } = req.body;

    chaosService.startExperiment({
      service,
      type: type as FailureType,
      value: value || 0,
      active: true,
      startTime: new Date()
    });

    successResponse(res, { message: 'Chaos experiment initiated' });
  } catch (error) {
    next(error);
  }
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
router.post('/stop', validateRequest({ body: stopChaosSchema }), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service, type } = req.body;

    chaosService.stopExperiment(service, type as FailureType);
    successResponse(res, { message: 'Chaos experiment stopped' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/chaos/stop-all
 * Stop all experiments
 */
router.post('/stop-all', (req: Request, res: Response, next: NextFunction) => {
  try {
    chaosService.stopAll();
    successResponse(res, { message: 'All chaos experiments stopped' });
  } catch (error) {
    next(error);
  }
});

export default router;
