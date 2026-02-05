/**
 * Unit Tests for ML Service
 * Tests prediction, training, and error handling functionality
 */

import { MLService } from '../ml.service';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ML Service', () => {
  let mlService: MLService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlService = new MLService();
  });

  describe('getPrediction', () => {
    test('should return prediction from ML service', async () => {
      const mockResponse = {
        data: {
          predictedTime: 5.5,
          confidence: 0.92,
          modelVersion: 'v20260205120000'
        }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/predict'),
        {
          taskSize: 2,
          taskType: 1,
          priority: 3,
          resourceLoad: 50
        },
        { timeout: 5000 }
      );
      expect(result.predictedTime).toBe(5.5);
      expect(result.confidence).toBe(0.92);
    });

    test('should use fallback prediction when ML service unavailable', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await mlService.getPrediction('SMALL', 'CPU', 3, 25);

      expect(result.modelVersion).toBe('fallback-v1');
      expect(result.confidence).toBe(0.65);
      expect(result.predictedTime).toBeGreaterThan(0);
    });

    test('should map task sizes correctly', async () => {
      mockedAxios.post.mockResolvedValue({ data: { predictedTime: 1, confidence: 0.9, modelVersion: 'v1' } });

      await mlService.getPrediction('SMALL', 'CPU', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskSize: 1 }),
        expect.any(Object)
      );

      await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskSize: 2 }),
        expect.any(Object)
      );

      await mlService.getPrediction('LARGE', 'CPU', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskSize: 3 }),
        expect.any(Object)
      );
    });

    test('should map task types correctly', async () => {
      mockedAxios.post.mockResolvedValue({ data: { predictedTime: 1, confidence: 0.9, modelVersion: 'v1' } });

      await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskType: 1 }),
        expect.any(Object)
      );

      await mlService.getPrediction('MEDIUM', 'IO', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskType: 2 }),
        expect.any(Object)
      );

      await mlService.getPrediction('MEDIUM', 'MIXED', 3, 50);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ taskType: 3 }),
        expect.any(Object)
      );
    });
  });

  describe('fallbackPrediction', () => {
    test('should calculate prediction based on size weight', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Unavailable'));

      const smallResult = await mlService.getPrediction('SMALL', 'CPU', 3, 0);
      const largeResult = await mlService.getPrediction('LARGE', 'CPU', 3, 0);

      // Large tasks should have higher predicted time
      expect(largeResult.predictedTime).toBeGreaterThan(smallResult.predictedTime);
    });

    test('should factor in resource load', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Unavailable'));

      const lowLoadResult = await mlService.getPrediction('MEDIUM', 'CPU', 3, 0);
      const highLoadResult = await mlService.getPrediction('MEDIUM', 'CPU', 3, 100);

      // Higher load should increase predicted time
      expect(highLoadResult.predictedTime).toBeGreaterThan(lowLoadResult.predictedTime);
    });

    test('should apply type weight for IO tasks', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Unavailable'));

      const cpuResult = await mlService.getPrediction('MEDIUM', 'CPU', 3, 50);
      const ioResult = await mlService.getPrediction('MEDIUM', 'IO', 3, 50);

      // IO tasks should have higher predicted time due to 1.5x multiplier
      expect(ioResult.predictedTime).toBeGreaterThan(cpuResult.predictedTime);
    });
  });

  describe('checkHealth', () => {
    test('should return true when ML service is healthy', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const result = await mlService.checkHealth();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        { timeout: 2000 }
      );
    });

    test('should return false when ML service is unavailable', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await mlService.checkHealth();

      expect(result).toBe(false);
    });

    test('should return false on timeout', async () => {
      mockedAxios.get.mockRejectedValueOnce({ code: 'ETIMEDOUT' });

      const result = await mlService.checkHealth();

      expect(result).toBe(false);
    });
  });
});

describe('ML Prediction Validation', () => {
  let mlService: MLService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlService = new MLService();
  });

  test('should handle invalid task size gracefully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { predictedTime: 1, confidence: 0.9, modelVersion: 'v1' } });

    // Invalid size should default to MEDIUM (2)
    await mlService.getPrediction('INVALID', 'CPU', 3, 50);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ taskSize: 2 }),
      expect.any(Object)
    );
  });

  test('should handle invalid task type gracefully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { predictedTime: 1, confidence: 0.9, modelVersion: 'v1' } });

    // Invalid type should default to CPU (1)
    await mlService.getPrediction('MEDIUM', 'INVALID', 3, 50);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ taskType: 1 }),
      expect.any(Object)
    );
  });
});
