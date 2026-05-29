/**
 * Simulation Platform — Barrel Export
 */

// Core types
export * from './types';
export * from './config';

// Simulation engine
export { SimulationEngine, createSimNode } from './engine';
export type { SchedulerPlugin, ScheduleContext, SimulationHooks, SimulationResult } from './engine';

// Schedulers
export {
  FCFSScheduler,
  RoundRobinScheduler,
  SJFScheduler,
  EDFScheduler,
  MinMinScheduler,
  IPSOScheduler,
  IACOScheduler,
  HybridHeuristicScheduler,
  createScheduler,
  ALL_SCHEDULER_NAMES,
} from './schedulers/algorithms';
export type { SchedulerName, PSOConfig, ACOConfig } from './schedulers/algorithms';

// DAG Schedulers
export { scheduleHEFT, scheduleCPOP, schedulePEFT, buildDAG } from './schedulers/dag-schedulers';
export type { DAG, DAGEdge } from './schedulers/dag-schedulers';

// Workload loaders
export {
  loadWorkload,
  generateSyntheticWorkload,
  loadGoogleTrace,
  loadAlibabaTrace,
  loadAzureTrace,
  DEFAULT_SYNTHETIC_CONFIG,
} from './workloads/trace-loader';
export type { SyntheticWorkloadConfig, WorkloadSource } from './workloads/trace-loader';

// Failure modeling
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
} from './failures/injector';
export type { FailureSchedule, FailureType, RetryPolicy, CheckpointState } from './failures/injector';

// Evaluation
export {
  calculateRunMetrics,
  aggregateResults,
  exportResultsCSV,
  exportResultsJSON,
  generateSummary,
} from './evaluation/metrics';

// Experiment runner
export { ExperimentRunner, runExperimentCLI } from './runner';
