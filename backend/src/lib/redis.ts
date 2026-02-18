import Redis from 'ioredis';
import logger from './logger';

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null; // Stop retrying
          }
          return Math.min(times * 200, 1000);
        }
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis Client Error', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('close', () => {
        logger.warn('Redis disconnected');
        this.isConnected = false;
      });

      // Wait for connection
      await this.client.ping();
      this.isConnected = true;
    } catch (error) {
      logger.warn('Failed to connect to Redis', { error: error instanceof Error ? error.message : String(error) });
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache methods
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch (error) {
      logger.error('Redis GET error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (expirySeconds) {
        await this.client!.setex(key, expirySeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async setJSON(key: string, value: object, expirySeconds?: number): Promise<boolean> {
    return this.set(key, JSON.stringify(value), expirySeconds);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  // Pub/Sub methods
  async publish(channel: string, message: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.publish(channel, message);
      return true;
    } catch (error) {
      logger.error('Redis PUBLISH error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  // Hash methods for storing objects
  async hSet(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error('Redis HSET error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      const value = await this.client!.hget(key, field);
      return value || null;
    } catch (error) {
      logger.error('Redis HGET error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string> | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.hgetall(key);
    } catch (error) {
      logger.error('Redis HGETALL error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  // List methods for queues
  async lPush(key: string, value: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.lpush(key, value);
      return true;
    } catch (error) {
      logger.error('Redis LPUSH error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async rPop(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.rpop(key);
    } catch (error) {
      logger.error('Redis RPOP error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async lLen(key: string): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.llen(key);
    } catch (error) {
      logger.error('Redis LLEN error', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  // Increment/Decrement for rate limiting
  async incr(key: string): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error('Redis EXPIRE error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}

export const redisService = new RedisService();
export default redisService;
