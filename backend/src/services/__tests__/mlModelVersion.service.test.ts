/**
 * Unit Tests for ML Model Version Service
 * Tests database-backed model versioning and auto-retrain functionality
 */

import { MLModelVersionService } from '../mlModelVersion.service';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    mlModel: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    trainingJob: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    autoRetrainConfig: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    scheduleHistory: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../websocket.service', () => ({
  getWebSocket: jest.fn(() => ({
    emitMLModelUpdated: jest.fn(),
    emitMLTrainingStarted: jest.fn(),
    emitMLTrainingCompleted: jest.fn(),
    emitMLTrainingFailed: jest.fn(),
  })),
}));

jest.mock('axios');
import axios from 'axios';
import prisma from '../../lib/prisma';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ML Model Version Service', () => {
  let mlModelVersionService: MLModelVersionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlModelVersionService = new MLModelVersionService();
  });

  describe('registerModel', () => {
    test('should archive existing active models and create new one', async () => {
      const mockModel = {
        id: 'model-1',
        version: 'v20260205120000',
        modelType: 'random_forest',
        status: 'ACTIVE',
        r2Score: 0.92,
      };

      (prisma.mlModel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.mlModel.create as jest.Mock).mockResolvedValue(mockModel);

      const result = await mlModelVersionService.registerModel(
        'v20260205120000',
        'random_forest',
        { r2Score: 0.92, featureImportance: { taskSize: 0.3, taskType: 0.25, priority: 0.2, resourceLoad: 0.25 } },
        1000
      );

      expect(prisma.mlModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { modelType: 'random_forest', status: 'ACTIVE' },
        })
      );
      expect(prisma.mlModel.create).toHaveBeenCalled();
      expect(result.version).toBe('v20260205120000');
    });
  });

  describe('getActiveModel', () => {
    test('should return the active model', async () => {
      const mockModel = {
        id: 'model-1',
        version: 'v20260205120000',
        status: 'ACTIVE',
      };

      (prisma.mlModel.findFirst as jest.Mock).mockResolvedValue(mockModel);

      const result = await mlModelVersionService.getActiveModel();

      expect(result).toBeDefined();
      expect(result?.status).toBe('ACTIVE');
    });

    test('should filter by model type when provided', async () => {
      (prisma.mlModel.findFirst as jest.Mock).mockResolvedValue(null);

      await mlModelVersionService.getActiveModel('xgboost');

      expect(prisma.mlModel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ modelType: 'xgboost' }),
        })
      );
    });
  });

  describe('checkAutoRetrain', () => {
    test('should return false when auto-retrain is disabled', async () => {
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: false,
        dataThreshold: 100,
        pendingDataPoints: 150,
      });

      const result = await mlModelVersionService.checkAutoRetrain();

      expect(result).toBe(false);
    });

    test('should return false when threshold not reached', async () => {
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: true,
        dataThreshold: 100,
        pendingDataPoints: 50,
        maxRetrainFrequency: 3600,
        lastRetrainAt: null,
      });

      const result = await mlModelVersionService.checkAutoRetrain();

      expect(result).toBe(false);
    });

    test('should return true when threshold reached and enough time passed', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: true,
        dataThreshold: 100,
        pendingDataPoints: 150,
        maxRetrainFrequency: 3600, // 1 hour
        lastRetrainAt: twoHoursAgo,
      });

      const result = await mlModelVersionService.checkAutoRetrain();

      expect(result).toBe(true);
    });

    test('should return false when retrain too recent', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: true,
        dataThreshold: 100,
        pendingDataPoints: 150,
        maxRetrainFrequency: 3600, // 1 hour
        lastRetrainAt: tenMinutesAgo,
      });

      const result = await mlModelVersionService.checkAutoRetrain();

      expect(result).toBe(false);
    });
  });

  describe('recordNewDataPoint', () => {
    test('should increment pending data points', async () => {
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: true,
        dataThreshold: 100,
        pendingDataPoints: 50,
        maxRetrainFrequency: 3600,
        lastRetrainAt: null,
      });
      (prisma.autoRetrainConfig.update as jest.Mock).mockResolvedValue({});

      await mlModelVersionService.recordNewDataPoint();

      expect(prisma.autoRetrainConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { pendingDataPoints: { increment: 1 } },
        })
      );
    });
  });

  describe('getTrainingJobs', () => {
    test('should return training job history', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'completed', triggerType: 'manual' },
        { id: 'job-2', status: 'completed', triggerType: 'auto' },
      ];

      (prisma.trainingJob.findMany as jest.Mock).mockResolvedValue(mockJobs);

      const result = await mlModelVersionService.getTrainingJobs(10);

      expect(result).toHaveLength(2);
      expect(prisma.trainingJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('updateRetrainConfig', () => {
    test('should update configuration', async () => {
      (prisma.autoRetrainConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: true,
        dataThreshold: 100,
      });
      (prisma.autoRetrainConfig.update as jest.Mock).mockResolvedValue({
        id: 'config-1',
        isEnabled: false,
        dataThreshold: 200,
      });

      const result = await mlModelVersionService.updateRetrainConfig({
        isEnabled: false,
        dataThreshold: 200,
      });

      expect(prisma.autoRetrainConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isEnabled: false, dataThreshold: 200 },
        })
      );
    });
  });
});

