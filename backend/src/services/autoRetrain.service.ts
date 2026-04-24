/**
 * Auto-Retrain Service
 * Checks AutoRetrainConfig and enqueues a retrain job when enough new data
 * has accumulated since the last retrain.
 *
 * Called by: the retrainQueue worker (repeatable cron job)
 * Calls:     POST /api/retrain/from-db on the ML service
 */

import axios from 'axios';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { errorRecovery } from './errorRecovery.service';

export interface RetrainResult {
  triggered: boolean;
  reason: string;
  rowsUsed?: number;
  r2Score?: number;
  modelVersion?: string;
  durationMs?: number;
}

export class AutoRetrainService {
  private readonly mlBaseUrl: string;

  constructor() {
    this.mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Main entry — called by the repeating BullMQ worker.
   * Returns a RetrainResult describing what happened (triggered or skipped).
   */
  async checkAndRetrain(): Promise<RetrainResult> {
    // 1. Load config (expect exactly one row; create default if missing)
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
      logger.info('AutoRetrainConfig created with defaults (disabled)');
    }

    if (!config.enabled) {
      return { triggered: false, reason: 'auto-retrain disabled in config' };
    }

    if (config.dataPointsSinceRetrain < config.minDataPointsThreshold) {
      return {
        triggered: false,
        reason: `insufficient new data: ${config.dataPointsSinceRetrain} / ${config.minDataPointsThreshold} required`,
      };
    }

    // 2. Check circuit breaker before hitting the ML service
    if (!errorRecovery.isServiceAvailable('ml-service')) {
      return { triggered: false, reason: 'ML service circuit breaker open' };
    }

    logger.info('Auto-retrain threshold met, calling ML service', {
      dataPoints: config.dataPointsSinceRetrain,
      threshold: config.minDataPointsThreshold,
    });

    const startMs = Date.now();

    // 3. Call /api/retrain/from-db (ML service reads PostgreSQL directly)
    try {
      const apiKey = process.env.ML_API_KEY || '';
      if (!apiKey) {
        logger.warn('ML_API_KEY not set — auto-retrain will be rejected by ML service');
      }

      const response = await axios.post<{
        success: boolean;
        rowsUsed: number;
        metrics: { r2_score: number };
        modelVersion: string;
      }>(
        `${this.mlBaseUrl}/api/retrain/from-db`,
        { model_type: 'xgboost', min_samples: config.minDataPointsThreshold },
        {
          headers: { 'X-API-Key': apiKey },
          timeout: 120_000, // retraining can take up to 2 minutes
        },
      );

      errorRecovery.recordSuccess('ml-service');

      const { rowsUsed, metrics, modelVersion } = response.data;
      const durationMs = Date.now() - startMs;

      logger.info('Auto-retrain completed', {
        rowsUsed,
        r2Score: metrics?.r2_score,
        modelVersion,
        durationMs,
      });

      // 4. Reset counter and record timestamp
      await prisma.autoRetrainConfig.update({
        where: { id: config.id },
        data: {
          dataPointsSinceRetrain: 0,
          lastCheckedAt: new Date(),
        },
      });

      // 5. Persist model version record in DB
      try {
        await prisma.mlModel.create({
          data: {
            version: modelVersion,
            modelType: 'xgboost',
            status: 'ACTIVE',
            r2Score: metrics?.r2_score ?? null,
            trainingDataCount: rowsUsed,
            activatedAt: new Date(),
          },
        });
      } catch (dbErr) {
        // Non-fatal — model is already deployed, just log
        logger.warn('Failed to persist MlModel record', { error: String(dbErr) });
      }

      return {
        triggered: true,
        reason: 'threshold met, retrain succeeded',
        rowsUsed,
        r2Score: metrics?.r2_score,
        modelVersion,
        durationMs,
      };
    } catch (error) {
      errorRecovery.recordFailure(
        'ml-service',
        error instanceof Error ? error : new Error(String(error)),
      );

      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Auto-retrain failed', { error: msg, durationMs: Date.now() - startMs });

      // Still reset lastCheckedAt so we don't hammer the service on every run
      await prisma.autoRetrainConfig.update({
        where: { id: config.id },
        data: { lastCheckedAt: new Date() },
      }).catch(() => {/* ignore secondary failure */});

      return { triggered: false, reason: `retrain call failed: ${msg}` };
    }
  }

  /**
   * Increment the new-data counter. Call this whenever a task completes
   * (i.e. actualTime is written). This is how the system knows enough
   * feedback has accumulated to justify a retrain.
   */
  async recordNewDataPoint(count: number = 1): Promise<void> {
    try {
      const config = await prisma.autoRetrainConfig.findFirst();
      if (!config) return;

      await prisma.autoRetrainConfig.update({
        where: { id: config.id },
        data: {
          dataPointsSinceRetrain: {
            increment: count,
          },
        },
      });
    } catch (err) {
      // Non-fatal — don't let a counter failure crash the task completion path
      logger.warn('Failed to increment auto-retrain data counter', { error: String(err) });
    }
  }
}

export const autoRetrainService = new AutoRetrainService();
