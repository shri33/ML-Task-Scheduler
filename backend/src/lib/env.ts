/**
 * Environment Configuration with Zod Validation
 * Provides type-safe, validated environment variable access
 * Server fails fast if required variables are missing
 */

import { z } from 'zod';

// Environment schema with validation rules
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),
  
  // Database (required)
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  
  // Redis (optional in development)
  REDIS_URL: z.string().url().optional(),
  
  // ML Service
  ML_SERVICE_URL: z.string().url().default('http://localhost:5001'),
  
  // CORS - required in production, optional in development
  CORS_ORIGIN: z.string().optional(),
  
  // JWT Authentication (required)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Swagger protection (optional in dev, recommended in production)
  SWAGGER_USER: z.string().optional(),
  SWAGGER_PASS: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).default('INFO'),
});

// Production-specific validation
const productionEnvSchema = envSchema.extend({
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required in production'),
  REDIS_URL: z.string().url().min(1, 'REDIS_URL is required in production'),
});

// Infer TypeScript type from schema
export type Env = z.infer<typeof envSchema>;

// Validated environment singleton
let validatedEnv: Env | null = null;

/**
 * Validates environment variables at startup
 * Throws descriptive error if validation fails
 */
export function validateEnv(): Env {
  if (validatedEnv) return validatedEnv;

  const isProduction = process.env.NODE_ENV === 'production';
  const schema = isProduction ? productionEnvSchema : envSchema;

  try {
    validatedEnv = schema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => {
        const path = e.path.join('.');
        return `  - ${path}: ${e.message}`;
      }).join('\n');
      
      console.error('\n❌ Environment validation failed:\n');
      console.error(missingVars);
      console.error('\n💡 Check your .env file or environment variables.\n');
      
      // Fail fast - don't start with invalid config
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Type-safe environment variable accessor
 * Must call validateEnv() first during startup
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnv() during startup.');
  }
  return validatedEnv;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}

export default { validateEnv, getEnv, isProduction, isDevelopment, isTest };
