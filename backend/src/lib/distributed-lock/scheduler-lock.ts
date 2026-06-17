import { acquireLock, releaseLock } from './redis-lock';
import logger from '../logger';

export const SCHEDULER_LOCK_KEY = 'scheduler:global-lock';
export const SCHEDULER_LOCK_TTL = 30; // 30 seconds

export async function withSchedulerLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const { acquired, token } = await acquireLock(SCHEDULER_LOCK_KEY, SCHEDULER_LOCK_TTL);
  
  if (!acquired) {
    logger.warn('Scheduler lock contention detected. Another instance is currently holding the scheduler lock.', {
      key: SCHEDULER_LOCK_KEY,
      ttl: SCHEDULER_LOCK_TTL
    });
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(SCHEDULER_LOCK_KEY, token);
  }
}
