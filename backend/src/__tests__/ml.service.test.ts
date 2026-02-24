/**
 * Unit Tests for ML Service
 * Tests the ML prediction service with fallback mechanisms
 */

// Mock dependencies before imports
jest.mock('axios');
jest.mock('../services/errorRecovery.service', () => ({
  __esModule: true,
  errorRecovery: {
    isServiceAvailable: jest.fn().mockReturnValue(true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn()
  }
}));
jest.mock('../lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    request: jest.fn()
  }
}));
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    prediction: {
      create: jest.fn().mockResolvedValue({})
    }
  }
}));

import { MLService } from '../services/ml.service';
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MLService', () => {
  let mlService: MLService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlService = new MLService();
  });

  describe('getPrediction', () => {
    it('should return prediction from ML service', async () => {
      const mockResponse = {
        data: {
          predictedTime: 5.5,
          confidence: 0.92,
          modelVersion: 'v20260131'
        }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      expect(result.predictedTime).toBe(5.5);
      expect(result.confidence).toBe(0.92);
      expect(result.modelVersion).toBe('v20260131');
    });

    it('should map task size correctly', async () => {
      const mockResponse = {
        data: { predictedTime: 3.0, confidence: 0.85, modelVersion: 'v1' }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await mlService.getPrediction('SMALL', 'CPU', 2, 30);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/predict'),
        expect.objectContaining({
          taskSize: 1, // SMALL = 1
          taskType: 1, // CPU = 1
          priority: 2,
          resourceLoad: 30
        }),
        expect.any(Object)
      );
    });

    it('should map MEDIUM size to 2', async () => {
      const mockResponse = {
        data: { predictedTime: 5.0, confidence: 0.9, modelVersion: 'v1' }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await mlService.getPrediction('MEDIUM', 'IO', 3, 40);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          taskSize: 2, // MEDIUM = 2
          taskType: 2  // IO = 2
        }),
        expect.any(Object)
      );
    });

    it('should map LARGE size to 3', async () => {
      const mockResponse = {
        data: { predictedTime: 10.0, confidence: 0.88, modelVersion: 'v1' }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await mlService.getPrediction('LARGE', 'MIXED', 5, 80);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          taskSize: 3, // LARGE = 3
          taskType: 3  // MIXED = 3
        }),
        expect.any(Object)
      );
    });

    it('should use fallback when ML service fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      // Should return fallback prediction
      expect(result.modelVersion).toBe('fallback-v1');
      expect(result.confidence).toBe(0.65); // Lower confidence for fallback
      expect(result.predictedTime).toBeGreaterThan(0);
    });

    it('should calculate fallback prediction based on task properties', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Timeout'));

      // LARGE task with high load should have higher predicted time
      const largeResult = await mlService.getPrediction('LARGE', 'IO', 5, 90);
      
      // Reset mock
      mockedAxios.post.mockRejectedValueOnce(new Error('Timeout'));
      
      // SMALL task with low load should have lower predicted time
      const smallResult = await mlService.getPrediction('SMALL', 'CPU', 1, 10);

      expect(largeResult.predictedTime).toBeGreaterThan(smallResult.predictedTime);
    });

    it('should handle unknown task size gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Error'));

      // Unknown size defaults to MEDIUM (2)
      const result = await mlService.getPrediction('UNKNOWN' as any, 'CPU', 3, 50);

      expect(result.predictedTime).toBeGreaterThan(0);
    });

    it('should apply IO task type multiplier in fallback', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Error'));
      const ioResult = await mlService.getPrediction('MEDIUM', 'IO', 3, 50);

      mockedAxios.post.mockRejectedValueOnce(new Error('Error'));
      const cpuResult = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      // IO tasks should take longer (1.5x multiplier)
      expect(ioResult.predictedTime).toBeGreaterThan(cpuResult.predictedTime);
    });
  });

  describe('Circuit Breaker Integration', () => {
    const { errorRecovery } = require('../services/errorRecovery.service');

    it('should use fallback when circuit breaker is open', async () => {
      errorRecovery.isServiceAvailable.mockReturnValueOnce(false);

      const result = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      expect(result.modelVersion).toBe('fallback-v1');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should record success on successful prediction', async () => {
      const mockResponse = {
        data: { predictedTime: 5.0, confidence: 0.9, modelVersion: 'v1' }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      expect(errorRecovery.recordSuccess).toHaveBeenCalledWith('ml-service');
    });

    it('should record failure on service error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Service unavailable'));

      await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      expect(errorRecovery.recordFailure).toHaveBeenCalledWith('ml-service', expect.any(Error));
    });
  });
});

// ==================== FALLBACK CALCULATION TESTS ====================

describe('Fallback Prediction Calculations', () => {
  let mlService: MLService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlService = new MLService();
    mockedAxios.post.mockRejectedValue(new Error('ML service down'));
  });

  it('should scale with resource load', async () => {
    const lowLoad = await mlService.getPrediction('MEDIUM', 'CPU', 3, 10);
    const highLoad = await mlService.getPrediction('MEDIUM', 'CPU', 3, 90);

    // Higher load should result in longer predicted time
    expect(highLoad.predictedTime).toBeGreaterThan(lowLoad.predictedTime);
  });

  it('should scale with task size', async () => {
    const small = await mlService.getPrediction('SMALL', 'CPU', 3, 50);
    const medium = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);
    const large = await mlService.getPrediction('LARGE', 'CPU', 3, 50);

    expect(small.predictedTime).toBeLessThan(medium.predictedTime);
    expect(medium.predictedTime).toBeLessThan(large.predictedTime);
  });

  it('should return positive prediction time', async () => {
    const result = await mlService.getPrediction('SMALL', 'CPU', 1, 0);
    
    expect(result.predictedTime).toBeGreaterThan(0);
  });

  it('should handle extreme values gracefully', async () => {
    const result = await mlService.getPrediction('LARGE', 'IO', 5, 100);
    
    expect(result.predictedTime).toBeLessThan(100); // Reasonable upper bound
    expect(result.predictedTime).toBeGreaterThan(0);
  });
});
