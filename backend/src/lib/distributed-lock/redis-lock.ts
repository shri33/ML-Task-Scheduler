import { randomUUID } from 'crypto';
import { redisService } from '../redis';
import logger from '../logger';

const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const EXTEND_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

export interface LockResult {
  acquired: boolean;
  token: string;
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<LockResult> {
  const client = redisService.getClient();
  const token = randomUUID();

  // In development/test, if Redis is down, we might fail-open if configured,
  // but for concurrency guarantees we should fail-closed in production.
  if (!client || !redisService.isAvailable()) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      logger.error(`Redis is unavailable. Lock acquisition failed for key: ${key}`);
      return { acquired: false, token: '' };
    }
    logger.warn(`Redis is unavailable. Fail-open lock acquisition for key: ${key}`);
    return { acquired: true, token };
  }

  try {
    const result = await client.set(key, token, 'EX', ttlSeconds, 'NX');
    const acquired = result === 'OK';
    return { acquired, token: acquired ? token : '' };
  } catch (error) {
    logger.error(`Error acquiring lock for key ${key}`, error instanceof Error ? error : new Error(String(error)));
    const isProduction = process.env.NODE_ENV === 'production';
    return { acquired: !isProduction, token: !isProduction ? token : '' };
  }
}

export async function releaseLock(key: string, token: string): Promise<boolean> {
  const client = redisService.getClient();
  if (!client || !redisService.isAvailable() || !token) {
    return true; // If Redis is down, consider released or bypass
  }

  try {
    const result = await client.eval(UNLOCK_SCRIPT, 1, key, token);
    return result === 1;
  } catch (error) {
    logger.error(`Error releasing lock for key ${key}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

export async function extendLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
  const client = redisService.getClient();
  if (!client || !redisService.isAvailable() || !token) {
    return false;
  }

  try {
    const result = await client.eval(EXTEND_SCRIPT, 1, key, token, ttlSeconds);
    return result === 1;
  } catch (error) {
    logger.error(`Error extending lock for key ${key}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

export async function withDistributedLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const { acquired, token } = await acquireLock(key, ttlSeconds);
  if (!acquired) {
    throw new Error(`Could not acquire lock for key: ${key}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}
