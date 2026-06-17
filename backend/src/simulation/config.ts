/**
 * Simulation Configuration
 * ========================
 * Default configuration values and configuration builder for experiments.
 * All magic numbers are centralized here — no hardcoded constants elsewhere.
 */

import {
  ExperimentConfig,
  FailureConfig,
  QueueModel,
  NodeTier,
  QueueDiscipline,
  ResourceCapacity,
} from './types';

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32 (deterministic, fast, 32-bit state)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian random using Box-Muller transform (seeded). */
export function gaussianRandom(rng: () => number, mean = 0, stddev = 1): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

/** Exponential random variable with given rate λ. */
export function exponentialRandom(rng: () => number, lambda: number): number {
  return -Math.log(Math.max(1e-10, rng())) / lambda;
}

/** Log-normal random variable. */
export function logNormalRandom(rng: () => number, mu: number, sigma: number): number {
  return Math.exp(gaussianRandom(rng, mu, sigma));
}

/** Generate an array of `count` seeds from a master seed. */
export function generateSeeds(masterSeed: number, count: number): number[] {
  const rng = mulberry32(masterSeed);
  return Array.from({ length: count }, () => Math.floor(rng() * 2147483647));
}

// ---------------------------------------------------------------------------
// Default Resource Profiles per Tier
// ---------------------------------------------------------------------------

export const DEFAULT_RESOURCE_PROFILES: Record<NodeTier, ResourceCapacity> = {
  [NodeTier.CLOUD]: {
    cpuCores: 64,
    cpuFreqGHz: 3.5,
    memoryMB: 262144,  // 256 GB
    vramMB: 81920,     // 80 GB (A100)
    storageMB: 2048000, // 2 TB
    networkBandwidthMbps: 25000, // 25 Gbps
  },
  [NodeTier.FOG]: {
    cpuCores: 16,
    cpuFreqGHz: 2.8,
    memoryMB: 32768,   // 32 GB
    vramMB: 8192,      // 8 GB (T4)
    storageMB: 512000,  // 512 GB
    networkBandwidthMbps: 10000, // 10 Gbps
  },
  [NodeTier.EDGE]: {
    cpuCores: 4,
    cpuFreqGHz: 2.0,
    memoryMB: 8192,    // 8 GB
    vramMB: 0,
    storageMB: 128000,  // 128 GB
    networkBandwidthMbps: 1000, // 1 Gbps
  },
  [NodeTier.DEVICE]: {
    cpuCores: 2,
    cpuFreqGHz: 1.5,
    memoryMB: 2048,    // 2 GB
    vramMB: 0,
    storageMB: 32000,   // 32 GB
    networkBandwidthMbps: 100, // 100 Mbps
  },
};

// ---------------------------------------------------------------------------
// Default Link Profiles between Tiers
// ---------------------------------------------------------------------------

export interface LinkProfile {
  latencyMs: number;
  jitterMs: number;
  bandwidthMbps: number;
  packetLossRate: number;
  congestionFactor: number;
}

/** Baseline link properties for connections between tier pairs. */
export const DEFAULT_LINK_PROFILES: Record<string, LinkProfile> = {
  'CLOUD-CLOUD': { latencyMs: 2, jitterMs: 0.5, bandwidthMbps: 100000, packetLossRate: 0.0001, congestionFactor: 1.2 },
  'CLOUD-FOG': { latencyMs: 20, jitterMs: 5, bandwidthMbps: 10000, packetLossRate: 0.001, congestionFactor: 1.5 },
  'FOG-FOG': { latencyMs: 10, jitterMs: 3, bandwidthMbps: 5000, packetLossRate: 0.001, congestionFactor: 1.3 },
  'FOG-EDGE': { latencyMs: 5, jitterMs: 2, bandwidthMbps: 1000, packetLossRate: 0.005, congestionFactor: 1.8 },
  'EDGE-EDGE': { latencyMs: 8, jitterMs: 3, bandwidthMbps: 500, packetLossRate: 0.005, congestionFactor: 1.5 },
  'EDGE-DEVICE': { latencyMs: 2, jitterMs: 1, bandwidthMbps: 100, packetLossRate: 0.01, congestionFactor: 2.0 },
  'DEVICE-DEVICE': { latencyMs: 15, jitterMs: 8, bandwidthMbps: 50, packetLossRate: 0.02, congestionFactor: 2.5 },
};

/** Get the link profile key for two tiers (order-independent). */
export function getLinkProfileKey(tierA: NodeTier, tierB: NodeTier): string {
  const tiers = [tierA, tierB].sort();
  const key = `${tiers[0]}-${tiers[1]}`;
  return DEFAULT_LINK_PROFILES[key] ? key : 'FOG-EDGE'; // fallback
}

// ---------------------------------------------------------------------------
// Default Failure Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_FAILURE_CONFIG: FailureConfig = {
  enabled: false,
  nodeFailureRate: 0.001,
  partitionRate: 0.0005,
  packetLossSpikeRate: 0.002,
  gpuOomRate: 0.01,
  globalMttf: 3600,  // 1 hour
  globalMttr: 120,   // 2 minutes
};

// ---------------------------------------------------------------------------
// Default Experiment Configuration
// ---------------------------------------------------------------------------

export function createDefaultExperimentConfig(overrides?: Partial<ExperimentConfig>): ExperimentConfig {
  const numRuns = overrides?.numRuns ?? 30;
  const masterSeed = 42;

  return {
    name: 'default-experiment',
    description: 'Default fog scheduling experiment',
    numRuns,
    seeds: generateSeeds(masterSeed, numRuns),
    topologyType: 'hierarchical',
    topologyParams: {},
    nodeCount: { cloud: 2, fog: 6, edge: 12, device: 24 },
    taskCount: 100,
    enableDAG: false,
    failureConfig: { ...DEFAULT_FAILURE_CONFIG },
    queueModel: QueueModel.MM1,
    algorithms: ['IPSO', 'IACO', 'HH', 'EDF', 'MIN_MIN', 'ROUND_ROBIN', 'FCFS'],
    workloadSource: 'synthetic',
    timeHorizon: 3600, // 1 hour
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cost Configuration (Real AWS/GCP pricing as of 2024-2025)
// ---------------------------------------------------------------------------

export const CLOUD_COST_CONFIG = {
  /** AWS on-demand pricing per core-second (c5.xlarge ~$0.17/hr / 4 cores). */
  cloudCoreSecond: 0.17 / 3600 / 4,
  /** AWS GPU instance (p3.2xlarge ~$3.06/hr). */
  cloudGpuHour: 3.06,
  /** AWS spot GPU (p3.2xlarge ~$0.92/hr). */
  spotGpuHour: 0.92,
  /** AWS egress first 10TB: $0.09/GB. */
  egressPerGB: 0.09,
  /** Inter-AZ transfer: $0.01/GB. */
  interAzPerGB: 0.01,
  /** Fog node cost (self-hosted, amortized): ~$0.02/core-hour. */
  fogCoreSecond: 0.02 / 3600,
  /** Edge device: negligible compute cost, but power. */
  edgePowerWattHour: 0.15, // $0.15/kWh average US electricity
};

// ---------------------------------------------------------------------------
// Queue Discipline Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_QUEUE_DISCIPLINES: Record<NodeTier, QueueDiscipline> = {
  [NodeTier.CLOUD]: QueueDiscipline.WFQ,
  [NodeTier.FOG]: QueueDiscipline.PRIORITY,
  [NodeTier.EDGE]: QueueDiscipline.EDF,
  [NodeTier.DEVICE]: QueueDiscipline.FCFS,
};
