import redisService from '../lib/redis';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  ML_PREDICTION: 300,      // 5 minutes
  RESOURCE_STATUS: 30,     // 30 seconds
  TASK_STATS: 60,          // 1 minute
  METRICS: 120,            // 2 minutes
  USER_SESSION: 3600       // 1 hour
};

class CacheService {
  // ML Prediction cache
  async getCachedPrediction(taskKey: string): Promise<any | null> {
    const cacheKey = `prediction:${taskKey}`;
    return redisService.getJSON(cacheKey);
  }

  async cachePrediction(taskKey: string, prediction: any): Promise<void> {
    const cacheKey = `prediction:${taskKey}`;
    await redisService.setJSON(cacheKey, prediction, CACHE_TTL.ML_PREDICTION);
  }

  // Resource status cache
  async getCachedResourceStatus(resourceId: string): Promise<any | null> {
    const cacheKey = `resource:${resourceId}`;
    return redisService.getJSON(cacheKey);
  }

  async cacheResourceStatus(resourceId: string, status: any): Promise<void> {
    const cacheKey = `resource:${resourceId}`;
    await redisService.setJSON(cacheKey, status, CACHE_TTL.RESOURCE_STATUS);
  }

  async invalidateResourceCache(resourceId: string): Promise<void> {
    await redisService.del(`resource:${resourceId}`);
  }

  // Task stats cache
  async getCachedTaskStats(): Promise<any | null> {
    return redisService.getJSON('task:stats');
  }

  async cacheTaskStats(stats: any): Promise<void> {
    await redisService.setJSON('task:stats', stats, CACHE_TTL.TASK_STATS);
  }

  async invalidateTaskStatsCache(): Promise<void> {
    await redisService.del('task:stats');
  }

  // Metrics cache
  async getCachedMetrics(): Promise<any | null> {
    return redisService.getJSON('metrics:dashboard');
  }

  async cacheMetrics(metrics: any): Promise<void> {
    await redisService.setJSON('metrics:dashboard', metrics, CACHE_TTL.METRICS);
  }

  async invalidateMetricsCache(): Promise<void> {
    await redisService.del('metrics:dashboard');
  }

  // User session cache
  async getUserSession(userId: string): Promise<any | null> {
    return redisService.getJSON(`session:${userId}`);
  }

  async setUserSession(userId: string, sessionData: any): Promise<void> {
    await redisService.setJSON(`session:${userId}`, sessionData, CACHE_TTL.USER_SESSION);
  }

  async invalidateUserSession(userId: string): Promise<void> {
    await redisService.del(`session:${userId}`);
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    return redisService.getJSON<T>(key);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await redisService.setJSON(key, value, ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await redisService.del(key);
  }

  // Invalidate all caches (for debugging/admin)
  async invalidateAll(): Promise<void> {
    // This would require KEYS command which is not recommended in production
    // Instead, we invalidate known cache patterns
    await this.invalidateTaskStatsCache();
    await this.invalidateMetricsCache();
  }
}

export const cacheService = new CacheService();
export default cacheService;
