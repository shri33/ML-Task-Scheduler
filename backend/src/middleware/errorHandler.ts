import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ML-Specific Error Classes
export class MLServiceError extends AppError {
  constructor(message: string, statusCode: number = 503) {
    super(message, statusCode, 'ML_SERVICE_ERROR');
    this.name = 'MLServiceError';
  }
}

export class MLPredictionError extends AppError {
  public readonly features?: Record<string, any>;

  constructor(message: string, features?: Record<string, any>) {
    super(message, 500, 'ML_PREDICTION_ERROR');
    this.name = 'MLPredictionError';
    this.features = features;
  }
}

export class MLTrainingError extends AppError {
  public readonly dataPointsProvided?: number;
  public readonly requiredDataPoints?: number;

  constructor(message: string, dataPointsProvided?: number, requiredDataPoints?: number) {
    super(message, 400, 'ML_TRAINING_ERROR');
    this.name = 'MLTrainingError';
    this.dataPointsProvided = dataPointsProvided;
    this.requiredDataPoints = requiredDataPoints;
  }
}

export class MLModelNotFoundError extends AppError {
  public readonly modelVersion?: string;

  constructor(message: string = 'ML model not found or not loaded', modelVersion?: string) {
    super(message, 404, 'ML_MODEL_NOT_FOUND');
    this.name = 'MLModelNotFoundError';
    this.modelVersion = modelVersion;
  }
}

export class MLServiceUnavailableError extends AppError {
  public readonly fallbackAvailable: boolean;

  constructor(message: string = 'ML service is unavailable', fallbackAvailable: boolean = true) {
    super(message, 503, 'ML_SERVICE_UNAVAILABLE');
    this.name = 'MLServiceUnavailableError';
    this.fallbackAvailable = fallbackAvailable;
  }
}

export class MLValidationError extends AppError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(message: string, validationErrors: Array<{ field: string; message: string }>) {
    super(message, 400, 'ML_VALIDATION_ERROR');
    this.name = 'MLValidationError';
    this.validationErrors = validationErrors;
  }
}

// Scheduling-Specific Errors
export class SchedulingError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'SCHEDULING_ERROR');
    this.name = 'SchedulingError';
  }
}

export class NoResourcesAvailableError extends AppError {
  constructor(message: string = 'No available resources for scheduling') {
    super(message, 400, 'NO_RESOURCES_AVAILABLE');
    this.name = 'NoResourcesAvailableError';
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  // ML-Specific Errors
  if (err instanceof MLServiceUnavailableError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      fallbackAvailable: err.fallbackAvailable,
      suggestion: 'The ML service is temporarily unavailable. Fallback predictions are being used.'
    });
  }

  if (err instanceof MLPredictionError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      features: err.features,
      suggestion: 'Check input features and ensure they are within valid ranges.'
    });
  }

  if (err instanceof MLTrainingError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      dataPointsProvided: err.dataPointsProvided,
      requiredDataPoints: err.requiredDataPoints,
      suggestion: 'Provide more training data to retrain the model.'
    });
  }

  if (err instanceof MLModelNotFoundError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      modelVersion: err.modelVersion,
      suggestion: 'The specified model version does not exist. Use the latest active model.'
    });
  }

  if (err instanceof MLValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      validationErrors: err.validationErrors
    });
  }

  if (err instanceof MLServiceError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // Scheduling Errors
  if (err instanceof NoResourcesAvailableError || err instanceof SchedulingError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // Generic AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    });
  }

  // Axios errors (from ML service calls)
  if ((err as any).isAxiosError) {
    const axiosError = err as any;
    if (axiosError.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'ML service connection refused',
        code: 'ML_SERVICE_UNAVAILABLE',
        suggestion: 'Ensure the ML service is running on the configured port.'
      });
    }
    if (axiosError.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'ML service request timed out',
        code: 'ML_SERVICE_TIMEOUT',
        suggestion: 'The ML service is taking too long to respond. Try again later.'
      });
    }
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};
