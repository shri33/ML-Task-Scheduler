/**
 * Failures Module — Barrel Export
 */
export {
  generateFailureSchedule,
  applyNodeCrash,
  applyNodeRecovery,
  shouldRetry,
  calculateRetryDelay,
  createCheckpoint,
  remainingTimeAfterRestore,
  willGpuOom,
  DEFAULT_RETRY_POLICY,
} from './injector';

export type {
  FailureSchedule,
  FailureType,
  RetryPolicy,
  CheckpointState,
} from './injector';
