/**
 * Advanced Error Recovery Service
 * Handles circuit breaker pattern, retry logic, and graceful degradation
 */

import logger from '../lib/logger';

type ServiceName = 'database' | 'redis' | 'ml-service' | 'email';

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  state: 'closed' | 'open' | 'half-open';
  successCount: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

class ErrorRecoveryService {
  private circuitBreakers: Map<ServiceName, CircuitBreakerState> = new Map();
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30000; // 30 seconds
  private readonly halfOpenSuccessThreshold = 3;

  constructor() {
    // Initialize circuit breakers for each service
    const services: ServiceName[] = ['database', 'redis', 'ml-service', 'email'];
    services.forEach(service => {
      this.circuitBreakers.set(service, {
        failures: 0,
        lastFailure: null,
        state: 'closed',
        successCount: 0,
      });
    });
  }

  /**
   * Check if a service is available (circuit breaker is closed or half-open)
   */
  isServiceAvailable(service: ServiceName): boolean {
    const state = this.circuitBreakers.get(service);
    if (!state) return true;

    if (state.state === 'closed') {
      return true;
    }

    if (state.state === 'open') {
      // Check if enough time has passed to try again
      if (state.lastFailure && Date.now() - state.lastFailure.getTime() > this.resetTimeout) {
        this.circuitBreakers.set(service, {
          ...state,
          state: 'half-open',
          successCount: 0,
        });
        logger.info(`Circuit breaker for ${service} moved to half-open state`);
        return true;
      }
      return false;
    }

    // half-open state - allow limited requests
    return true;
  }

  /**
   * Record a successful service call
   */
  recordSuccess(service: ServiceName): void {
    const state = this.circuitBreakers.get(service);
    if (!state) return;

    if (state.state === 'half-open') {
      const newSuccessCount = state.successCount + 1;
      if (newSuccessCount >= this.halfOpenSuccessThreshold) {
        // Reset to closed state
        this.circuitBreakers.set(service, {
          failures: 0,
          lastFailure: null,
          state: 'closed',
          successCount: 0,
        });
        logger.info(`Circuit breaker for ${service} recovered to closed state`);
      } else {
        this.circuitBreakers.set(service, {
          ...state,
          successCount: newSuccessCount,
        });
      }
    } else if (state.state === 'closed' && state.failures > 0) {
      // Decay failures on success
      this.circuitBreakers.set(service, {
        ...state,
        failures: Math.max(0, state.failures - 1),
      });
    }
  }

  /**
   * Record a failed service call
   */
  recordFailure(service: ServiceName, error?: Error): void {
    const state = this.circuitBreakers.get(service);
    if (!state) return;

    const newFailures = state.failures + 1;

    if (state.state === 'half-open') {
      // Immediately open the circuit on failure in half-open state
      this.circuitBreakers.set(service, {
        failures: newFailures,
        lastFailure: new Date(),
        state: 'open',
        successCount: 0,
      });
      logger.warn(`Circuit breaker for ${service} opened (failure in half-open)`);
    } else if (newFailures >= this.failureThreshold) {
      // Open the circuit
      this.circuitBreakers.set(service, {
        failures: newFailures,
        lastFailure: new Date(),
        state: 'open',
        successCount: 0,
      });
      logger.warn(`Circuit breaker for ${service} opened after ${newFailures} failures`);
    } else {
      this.circuitBreakers.set(service, {
        ...state,
        failures: newFailures,
        lastFailure: new Date(),
      });
    }

    logger.error(`Service ${service} failure recorded`, error, { failures: newFailures });
  }

  /**
   * Get circuit breaker status for all services
   */
  getStatus(): Record<ServiceName, { state: string; failures: number; available: boolean }> {
    const status: Record<string, { state: string; failures: number; available: boolean }> = {};
    
    this.circuitBreakers.forEach((state, service) => {
      status[service] = {
        state: state.state,
        failures: state.failures,
        available: this.isServiceAvailable(service),
      };
    });

    return status as Record<ServiceName, { state: string; failures: number; available: boolean }>;
  }

  /**
   * Execute with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    service: ServiceName,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig: RetryConfig = {
      maxRetries: config.maxRetries ?? 3,
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 10000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };

    if (!this.isServiceAvailable(service)) {
      throw new Error(`Service ${service} is currently unavailable (circuit breaker open)`);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.recordSuccess(service);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn(`Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed for ${service}`, {
          error: lastError.message,
          attempt: attempt + 1,
        });

        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
            retryConfig.maxDelay
          );
          await this.sleep(delay);
        }
      }
    }

    this.recordFailure(service, lastError);
    throw lastError;
  }

  /**
   * Execute with fallback - tries primary, falls back to secondary on failure
   */
  async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => T | Promise<T>,
    service: ServiceName
  ): Promise<T> {
    try {
      if (!this.isServiceAvailable(service)) {
        logger.info(`Using fallback for ${service} (circuit open)`);
        return await fallback();
      }

      const result = await primary();
      this.recordSuccess(service);
      return result;
    } catch (error) {
      this.recordFailure(service, error instanceof Error ? error : undefined);
      logger.warn(`Primary failed for ${service}, using fallback`, { error: String(error) });
      return await fallback();
    }
  }

  /**
   * Graceful degradation - returns cached/default value if service fails
   */
  async executeWithGracefulDegradation<T>(
    fn: () => Promise<T>,
    defaultValue: T,
    service: ServiceName,
    cacheTtl?: number
  ): Promise<T> {
    const cacheKey = `degradation_cache_${service}`;
    let cachedValue: T | undefined;

    try {
      if (!this.isServiceAvailable(service)) {
        logger.info(`Graceful degradation for ${service} - using default value`);
        return defaultValue;
      }

      const result = await fn();
      this.recordSuccess(service);
      return result;
    } catch (error) {
      this.recordFailure(service, error instanceof Error ? error : undefined);
      logger.warn(`Graceful degradation for ${service}`, { error: String(error) });
      return cachedValue ?? defaultValue;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset a specific circuit breaker (for admin/recovery purposes)
   */
  resetCircuitBreaker(service: ServiceName): void {
    this.circuitBreakers.set(service, {
      failures: 0,
      lastFailure: null,
      state: 'closed',
      successCount: 0,
    });
    logger.info(`Circuit breaker for ${service} manually reset`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakers.forEach((_, service) => {
      this.resetCircuitBreaker(service);
    });
  }
}

// Singleton instance
export const errorRecovery = new ErrorRecoveryService();
export default errorRecovery;
