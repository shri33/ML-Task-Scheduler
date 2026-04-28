/**
 * Request Validation Middleware
 * - UUID path parameter validation
 * - Input sanitization (strip HTML/scripts)
 */

import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware that validates a path parameter is a valid UUID.
 * Returns 400 instead of letting invalid IDs hit Prisma (which returns P2025).
 */
export function validateUUID(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const param of paramNames) {
      const value = req.params[param];
      if (value && !UUID_REGEX.test(value)) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${param} format. Expected UUID.`,
        });
      }
    }
    next();
  };
}

/**
 * Strip HTML tags and script content from string values in req.body.
 * Prevents stored XSS when task names or other user input is rendered.
 * Only processes top-level string fields (non-recursive for performance).
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        // Strip HTML tags and trim whitespace
        req.body[key] = req.body[key]
          .replace(/<[^>]*>/g, '')  // Remove HTML tags
          .replace(/javascript:/gi, '')  // Remove javascript: URIs
          .replace(/on\w+\s*=/gi, '')  // Remove inline event handlers
          .trim();
      }
    }
  }
  next();
}
