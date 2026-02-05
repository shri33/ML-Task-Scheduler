/**
 * Unit Tests for Error Handler Middleware
 * Tests all error types including ML-specific errors
 */

import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  MLServiceError,
  MLPredictionError,
  MLTrainingError,
  MLModelNotFoundError,
  MLServiceUnavailableError,
  MLValidationError,
  SchedulingError,
  NoResourcesAvailableError,
  errorHandler,
} from '../errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {};
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
    console.error = jest.fn(); // Suppress console.error in tests
  });

  describe('AppError', () => {
    test('should handle generic AppError', () => {
      const error = new AppError('Something went wrong', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Something went wrong',
        })
      );
    });

    test('should include error code when provided', () => {
      const error = new AppError('Custom error', 400, 'CUSTOM_ERROR');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CUSTOM_ERROR',
        })
      );
    });
  });

  describe('ML Service Errors', () => {
    test('should handle MLServiceUnavailableError with fallback info', () => {
      const error = new MLServiceUnavailableError('ML service is down', true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'ML_SERVICE_UNAVAILABLE',
          fallbackAvailable: true,
          suggestion: expect.any(String),
        })
      );
    });

    test('should handle MLPredictionError with features', () => {
      const features = { taskSize: 2, taskType: 1, priority: 3, resourceLoad: 50 };
      const error = new MLPredictionError('Prediction failed', features);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ML_PREDICTION_ERROR',
          features,
          suggestion: expect.any(String),
        })
      );
    });

    test('should handle MLTrainingError with data point info', () => {
      const error = new MLTrainingError('Insufficient data', 5, 10);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ML_TRAINING_ERROR',
          dataPointsProvided: 5,
          requiredDataPoints: 10,
        })
      );
    });

    test('should handle MLModelNotFoundError with version', () => {
      const error = new MLModelNotFoundError('Model not found', 'v20260101');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ML_MODEL_NOT_FOUND',
          modelVersion: 'v20260101',
        })
      );
    });

    test('should handle MLValidationError with validation details', () => {
      const validationErrors = [
        { field: 'taskSize', message: 'Must be between 1 and 3' },
        { field: 'priority', message: 'Must be between 1 and 5' },
      ];
      const error = new MLValidationError('Invalid input', validationErrors);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ML_VALIDATION_ERROR',
          validationErrors,
        })
      );
    });

    test('should handle generic MLServiceError', () => {
      const error = new MLServiceError('Service error', 503);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ML_SERVICE_ERROR',
        })
      );
    });
  });

  describe('Scheduling Errors', () => {
    test('should handle SchedulingError', () => {
      const error = new SchedulingError('Scheduling failed', 500);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SCHEDULING_ERROR',
        })
      );
    });

    test('should handle NoResourcesAvailableError', () => {
      const error = new NoResourcesAvailableError();

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NO_RESOURCES_AVAILABLE',
          error: 'No available resources for scheduling',
        })
      );
    });
  });

  describe('Zod Validation Errors', () => {
    test('should handle ZodError', () => {
      const { ZodError } = require('zod');
      const error = new ZodError([
        { path: ['email'], message: 'Invalid email', code: 'invalid_type', expected: 'string', received: 'undefined' },
      ]);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.any(Array),
        })
      );
    });
  });

  describe('Database Errors', () => {
    test('should handle Prisma errors', () => {
      const error = new Error('Database error');
      error.name = 'PrismaClientKnownRequestError';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_ERROR',
        })
      );
    });
  });

  describe('Generic Errors', () => {
    test('should handle unknown errors as internal server error', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });
});

describe('Error Classes', () => {
  test('MLServiceUnavailableError should set default values', () => {
    const error = new MLServiceUnavailableError();

    expect(error.message).toBe('ML service is unavailable');
    expect(error.statusCode).toBe(503);
    expect(error.fallbackAvailable).toBe(true);
  });

  test('MLModelNotFoundError should set default message', () => {
    const error = new MLModelNotFoundError();

    expect(error.message).toBe('ML model not found or not loaded');
  });

  test('NoResourcesAvailableError should set default message', () => {
    const error = new NoResourcesAvailableError();

    expect(error.message).toBe('No available resources for scheduling');
  });

  test('All error classes should be instances of AppError', () => {
    expect(new MLServiceError('test', 500)).toBeInstanceOf(AppError);
    expect(new MLPredictionError('test')).toBeInstanceOf(AppError);
    expect(new MLTrainingError('test')).toBeInstanceOf(AppError);
    expect(new MLModelNotFoundError()).toBeInstanceOf(AppError);
    expect(new MLServiceUnavailableError()).toBeInstanceOf(AppError);
    expect(new MLValidationError('test', [])).toBeInstanceOf(AppError);
    expect(new SchedulingError('test')).toBeInstanceOf(AppError);
    expect(new NoResourcesAvailableError()).toBeInstanceOf(AppError);
  });
});
