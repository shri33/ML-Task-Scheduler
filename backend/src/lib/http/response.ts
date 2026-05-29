import { Response } from 'express';
import { PaginationParams } from '../pagination';

export function successResponse<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data
  });
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode: number,
  details?: unknown
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    }
  });
}

export function paginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  params: PaginationParams
): void {
  res.status(200).json({
    success: true,
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit)
    }
  });
}
