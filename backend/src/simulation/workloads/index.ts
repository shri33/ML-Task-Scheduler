/**
 * Workloads Module — Barrel Export
 */
export {
  loadWorkload,
  generateSyntheticWorkload,
  loadGoogleTrace,
  loadAlibabaTrace,
  loadAzureTrace,
  DEFAULT_SYNTHETIC_CONFIG,
} from './trace-loader';

export type {
  SyntheticWorkloadConfig,
  WorkloadSource,
  GoogleTraceConfig,
  AlibabaTraceConfig,
  AzureTraceConfig,
} from './trace-loader';
