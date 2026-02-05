/**
 * ML Model Routes
 * Endpoints for ML model versioning, training, and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { mlService } from '../services/ml.service';
import { mlModelVersionService } from '../services/mlModelVersion.service';
import { z } from 'zod';
import { MLTrainingError } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const retrainConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  dataThreshold: z.number().min(10).max(1000).optional(),
  accuracyThreshold: z.number().min(0.5).max(1).optional(),
  maxRetrainFrequency: z.number().min(60).max(86400).optional(),
});

const manualTrainSchema = z.object({
  modelType: z.enum(['random_forest', 'xgboost', 'gradient_boosting']).optional(),
});

/**
 * @route GET /api/ml/status
 * @desc Get ML service status and health
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [isHealthy, modelInfo, activeModel] = await Promise.all([
      mlService.checkHealth(),
      mlService.getModelInfo().catch(() => null),
      mlModelVersionService.getActiveModel(),
    ]);

    const healthStatus = mlService.getHealthStatus();

    res.json({
      success: true,
      data: {
        service: {
          isHealthy,
          fallbackMode: !isHealthy,
          consecutiveFailures: healthStatus.consecutiveFailures,
        },
        model: modelInfo,
        activeModelDb: activeModel ? {
          id: activeModel.id,
          version: activeModel.version,
          modelType: activeModel.modelType,
          r2Score: activeModel.r2Score,
          trainedAt: activeModel.trainedAt,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ml/models
 * @desc Get all registered model versions
 */
router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const models = await mlModelVersionService.getAllModels(limit);

    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ml/models/comparison
 * @desc Get model performance comparison
 */
router.get('/models/comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comparison = await mlModelVersionService.getModelComparison();

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ml/training/jobs
 * @desc Get training job history
 */
router.get('/training/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const jobs = await mlModelVersionService.getTrainingJobs(limit);

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/ml/training/trigger
 * @desc Manually trigger model retraining
 */
router.post('/training/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelType } = manualTrainSchema.parse(req.body);

    await mlModelVersionService.triggerManualRetrain(modelType);

    res.json({
      success: true,
      message: 'Model retraining triggered successfully',
    });
  } catch (error: any) {
    if (error.message === 'Retrain already in progress') {
      return res.status(409).json({
        success: false,
        error: 'A retraining job is already in progress',
      });
    }
    next(error);
  }
});

/**
 * @route GET /api/ml/retrain/config
 * @desc Get auto-retrain configuration
 */
router.get('/retrain/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await mlModelVersionService.getRetrainConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/ml/retrain/config
 * @desc Update auto-retrain configuration
 */
router.put('/retrain/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedConfig = retrainConfigSchema.parse(req.body);
    const updatedConfig = await mlModelVersionService.updateRetrainConfig(validatedConfig);

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Auto-retrain configuration updated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/ml/predict/compare
 * @desc Compare predictions from different model types
 */
router.post('/predict/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskSize, taskType, priority, resourceLoad } = req.body;

    const comparison = await mlService.compareModels({
      taskSize,
      taskType,
      priority,
      resourceLoad,
    });

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ml/health
 * @desc Quick health check for ML service
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await mlService.checkHealth();

    res.json({
      success: true,
      data: {
        mlServiceHealthy: isHealthy,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
