import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../lib/logger';

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

// ML-specific error classes
export class MLServiceError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'ML_SERVICE_ERROR');
    this.name = 'MLServiceError';
  }
}

export class MLPredictionError extends MLServiceError {
  constructor(message: string = 'Failed to generate ML prediction') {
    super(message, 500);
    this.name = 'MLPredictionError';
  }
}

export class MLTrainingError extends MLServiceError {
  constructor(message: string = 'Failed to train ML model') {
    super(message, 500);
    this.name = 'MLTrainingError';
  }
}

export class MLModelNotFoundError extends MLServiceError {
  constructor(message: string = 'ML model not found') {
    super(message, 404);
    this.name = 'MLModelNotFoundError';
  }
}

export class MLServiceUnavailableError extends MLServiceError {
  constructor(message: string = 'ML service is unavailable') {
    super(message, 503);
    this.name = 'MLServiceUnavailableError';
  }
}

export class MLValidationError extends MLServiceError {
  constructor(message: string = 'Invalid input for ML prediction') {
    super(message, 400);
    this.name = 'MLValidationError';
  }
}

// Scheduling-specific error classes
export class SchedulingError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'SCHEDULING_ERROR');
    this.name = 'SchedulingError';
  }
}

export class NoResourcesAvailableError extends SchedulingError {
  constructor(message: string = 'No resources available for scheduling') {
    super(message, 503);
    this.name = 'NoResourcesAvailableError';
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Unhandled error', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      error: 'Database operation failed'
    });
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
