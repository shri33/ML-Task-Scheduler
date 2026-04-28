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
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error with context
  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    url: req.url,
    error: err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: isProduction ? undefined : err.stack
    } : err
  });

  // 1. Operational Errors (AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      requestId
    });
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map(e => ({ path: e.path, message: e.message })),
      requestId
    });
  }

  // 3. Prisma Database Errors
  if (err.name?.startsWith('Prisma') || err.code?.startsWith('P')) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A resource with this value already exists',
        details: err.meta,
        requestId
      });
    }

    // Other Prisma errors (usually connection/infra)
    const message = isProduction ? 'Database service error' : err.message;
    return res.status(503).json({
      success: false,
      error: message,
      requestId
    });
  }

  // 4. Default Internal Server Error
  const status = err.status || err.statusCode || 500;
  const message = isProduction ? 'An unexpected error occurred' : err.message;

  return res.status(status).json({
    success: false,
    error: message,
    requestId,
    // Include stack only in development for easier debugging
    stack: isProduction ? undefined : err.stack
  });
};
