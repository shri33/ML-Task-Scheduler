import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { autoRetrainService } from '../services/autoRetrain.service';
import { mlService } from '../services/ml.service';
import logger from '../lib/logger';
import { emitToAll } from '../lib/socket';

const router = Router();

// All ML management routes require admin privileges
router.use(authenticate, adminOnly);

/**
 * @swagger
 * /api/v1/ml/models:
 *   get:
 *     summary: List all trained models
 *     tags: [ML]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of models
 */
router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await prisma.mlModel.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: models });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ml/config
 * Get auto-retrain configuration
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let config = await prisma.autoRetrainConfig.findFirst();
    if (!config) {
      config = await prisma.autoRetrainConfig.create({
        data: {
          enabled: false,
          minDataPointsThreshold: 100,
          maxDataPointsThreshold: 1000,
          r2ScoreThreshold: 0.8,
          dataPointsSinceRetrain: 0,
        },
      });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/ml/config
 * Update auto-retrain configuration
 */
router.patch('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.autoRetrainConfig.findFirst();
    if (!config) return res.status(404).json({ success: false, error: 'Config not found' });

    const updated = await prisma.autoRetrainConfig.update({
      where: { id: config.id },
      data: req.body
    });

    emitToAll('model:config_updated', updated);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ml/retrain
 * Manually trigger retraining
 */
router.post('/retrain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Create a training job record
    const job = await prisma.trainingJob.create({
      data: {
        status: 'TRAINING',
        triggerType: 'manual',
        triggerReason: req.body.reason || 'User manual trigger'
      }
    });

    emitToAll('model:retraining_started', { jobId: job.id });

    // Trigger async retraining
    autoRetrainService.checkAndRetrain().then(async (result) => {
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: {
          status: result.triggered ? 'ACTIVE' : 'FAILED',
          completedAt: new Date(),
          modelVersion: result.modelVersion,
          error: result.reason && !result.triggered ? result.reason : null,
          dataPointsNew: result.rowsUsed
        }
      });
    }).catch(async (err) => {
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: String(err)
        }
      });
    });

    res.json({ 
      success: true, 
      data: { 
        jobId: job.id, 
        message: 'Retraining initiated in background' 
      } 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/ml/training-jobs:
 *   get:
 *     summary: List training jobs
 *     tags: [ML]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of training jobs
 */
router.get('/training-jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.trainingJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20
    });
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ml/info
 * Get current model info from ML service
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await mlService.getModelInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    next(error);
  }
});

export default router;
