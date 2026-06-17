/**
 * Core Simulation Types
 * =====================
 * Shared type definitions used across all simulation subsystems.
 * These types model a realistic fog computing environment with:
 *   - hierarchical node tiers (cloud / fog / edge / device)
 *   - constrained resources (CPU, RAM, VRAM, bandwidth, storage)
 *   - network links with latency, jitter, bandwidth, loss
 *   - task models with data locality, DAG deps, deadlines
 */

// ---------------------------------------------------------------------------
// Node Types
// ---------------------------------------------------------------------------

export enum NodeTier {
  CLOUD = 'CLOUD',
  FOG = 'FOG',
  EDGE = 'EDGE',
  DEVICE = 'DEVICE',
}

/** Hardware resource capacity for a single compute node. */
export interface ResourceCapacity {
  cpuCores: number;
  cpuFreqGHz: number;
  memoryMB: number;
  vramMB: number;
  storageMB: number;
  networkBandwidthMbps: number;
}

/** Resource currently in use on a node (always <= capacity). */
export interface ResourceUsage {
  cpuCores: number;
  memoryMB: number;
  vramMB: number;
  storageMB: number;
  activeBandwidthMbps: number;
}

/** A compute node in the simulation topology. */
export interface SimNode {
  id: string;
  name: string;
  tier: NodeTier;
  regionId: string;
  capacity: ResourceCapacity;
  usage: ResourceUsage;
  /** Power consumption in watts at idle / full load. */
  powerIdle: number;
  powerFull: number;
  /** Whether the node is currently alive (false = failed). */
  alive: boolean;
  /** Mean Time To Failure in seconds (exponential distribution). */
  mttf: number;
  /** Mean Time To Repair in seconds. */
  mttr: number;
  /** Simulation time at which the node last came online. */
  upSince: number;
  /** Per-unit compute cost ($/core-second). */
  costPerCoreSec: number;
  /** Egress cost ($/MB). */
  egressCostPerMB: number;
  /** Queue discipline for this node. */
  queueDiscipline: QueueDiscipline;
}

// ---------------------------------------------------------------------------
// Network Link Types
// ---------------------------------------------------------------------------

export interface LinkProperties {
  /** One-way propagation latency in milliseconds. */
  latencyMs: number;
  /** Jitter standard deviation in milliseconds (added as Gaussian noise). */
  jitterMs: number;
  /** Maximum bandwidth capacity in Mbps. */
  bandwidthMbps: number;
  /** Current aggregate utilization (0–1). */
  utilization: number;
  /** Baseline packet loss rate (0–1). */
  packetLossRate: number;
  /** Congestion multiplier applied when utilization > 0.8. */
  congestionFactor: number;
}

/** A directed link between two nodes in the topology graph. */
export interface TopologyLink {
  sourceId: string;
  targetId: string;
  properties: LinkProperties;
}

// ---------------------------------------------------------------------------
// Queue Types
// ---------------------------------------------------------------------------

export enum QueueDiscipline {
  FCFS = 'FCFS',
  PRIORITY = 'PRIORITY',
  EDF = 'EDF',
  WFQ = 'WFQ',
}

export enum QueueModel {
  MM1 = 'MM1',
  MG1 = 'MG1',
}

export interface QueueState {
  /** Current number of tasks waiting. */
  length: number;
  /** Arrival rate λ (tasks/second). */
  arrivalRate: number;
  /** Service rate μ (tasks/second). */
  serviceRate: number;
  /** Utilization ρ = λ/μ. */
  utilization: number;
  /** Expected wait time (seconds) — model-dependent. */
  expectedWaitTime: number;
  /** Time-weighted average queue length. */
  avgLength: number;
  /** History of utilization samples for plotting. */
  utilizationHistory: Array<{ time: number; utilization: number }>;
}

// ---------------------------------------------------------------------------
// Task Types
// ---------------------------------------------------------------------------

export enum TaskState {
  WAITING = 'WAITING',
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  MIGRATING = 'MIGRATING',
  CHECKPOINTED = 'CHECKPOINTED',
}

export interface TaskRequirements {
  cpuCores: number;
  memoryMB: number;
  vramMB: number;
  storageMB: number;
  bandwidthMbps: number;
}

export interface SimTask {
  id: string;
  name: string;
  /** The node where the task's input data resides. */
  originNodeId: string;
  /** Category/type for ML feature extraction. */
  category: number;
  requirements: TaskRequirements;
  /** Data size in MB that must be transferred to the executing node. */
  dataSizeMB: number;
  /** Estimated execution time in seconds (from trace or model). */
  estimatedExecTime: number;
  /** Actual execution time (set after completion, drawn from distribution). */
  actualExecTime: number;
  /** Deadline in absolute simulation seconds. */
  deadline: number;
  /** Priority 1-5 (5 = highest). */
  priority: number;
  /** Current state in the lifecycle. */
  state: TaskState;
  /** Node currently assigned to (null if unassigned). */
  assignedNodeId: string | null;
  /** IDs of tasks this task depends on (DAG edges). */
  dependencies: string[];
  /** Number of retries so far. */
  retryCount: number;
  /** Maximum allowed retries. */
  maxRetries: number;
  /** Whether the task supports checkpoint/restart. */
  checkpointable: boolean;
  /** Cost to migrate this task (seconds of overhead). */
  migrationCostSec: number;
  /** Simulation time at which the task was created/submitted. */
  submitTime: number;
  /** Simulation time at which execution started. */
  startTime: number;
  /** Simulation time at which the task completed (or failed). */
  endTime: number;
  /** Time spent waiting in queue. */
  queueWaitTime: number;
  /** Time spent transferring data. */
  transferTime: number;
}

// ---------------------------------------------------------------------------
// Scheduling Types
// ---------------------------------------------------------------------------

export interface SchedulingDecision {
  taskId: string;
  targetNodeId: string;
  /** Algorithm that made this decision. */
  algorithm: string;
  /** Predicted execution time (from ML or heuristic). */
  predictedExecTime: number;
  /** Predicted transfer time. */
  predictedTransferTime: number;
  /** Predicted queue wait. */
  predictedQueueWait: number;
  /** Total predicted makespan for this task. */
  predictedTotal: number;
  /** Fitness/score of this assignment. */
  score: number;
  /** Reason string for debugging/visualization. */
  reason: string;
  /** Simulation time of the decision. */
  decisionTime: number;
}

export interface SchedulingSolution {
  decisions: SchedulingDecision[];
  /** Global fitness of the solution. */
  fitness: number;
  /** Algorithm execution wall-clock time (ms). */
  solverTimeMs: number;
  /** Algorithm identifier. */
  algorithm: string;
  /** Seed used for reproducibility. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Experiment / Evaluation Types
// ---------------------------------------------------------------------------

export interface ExperimentConfig {
  name: string;
  description: string;
  /** Number of independent runs for statistical significance. */
  numRuns: number;
  /** Seeds for each run (length = numRuns). */
  seeds: number[];
  /** Topology generator to use. */
  topologyType: 'waxman' | 'barabasi-albert' | 'hierarchical' | 'custom';
  topologyParams: Record<string, number | string>;
  /** Number of nodes per tier. */
  nodeCount: { cloud: number; fog: number; edge: number; device: number };
  /** Number of tasks. */
  taskCount: number;
  /** Whether to use DAG workflows. */
  enableDAG: boolean;
  /** Failure injection config. */
  failureConfig: FailureConfig;
  /** Queue model to use. */
  queueModel: QueueModel;
  /** Algorithms to compare. */
  algorithms: string[];
  /** Workload source. */
  workloadSource: 'synthetic' | 'google-trace' | 'alibaba-trace' | 'azure-trace';
  workloadPath?: string;
  /** Time horizon in simulation seconds. */
  timeHorizon: number;
}

export interface FailureConfig {
  enabled: boolean;
  /** Node failure rate (probability per simulation tick). */
  nodeFailureRate: number;
  /** Network partition probability. */
  partitionRate: number;
  /** Packet loss spike probability. */
  packetLossSpikeRate: number;
  /** GPU OOM probability for GPU tasks. */
  gpuOomRate: number;
  /** MTTF in seconds (overrides per-node if set). */
  globalMttf?: number;
  /** MTTR in seconds. */
  globalMttr?: number;
}

export interface RunMetrics {
  makespan: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  avgQueueWait: number;
  totalEnergy: number;
  throughput: number;
  slaViolations: number;
  slaViolationRate: number;
  migrationCount: number;
  retryCount: number;
  failedTasks: number;
  completedTasks: number;
  networkUtilization: number;
  avgBandwidthSaturation: number;
  avgNodeUtilization: number;
  fairnessIndex: number;
  solverTimeMs: number;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  algorithm: string;
  runs: RunMetrics[];
  /** Aggregated stats across all runs. */
  mean: RunMetrics;
  stddev: RunMetrics;
  ci95Lower: RunMetrics;
  ci95Upper: RunMetrics;
}

// ---------------------------------------------------------------------------
// Simulation Clock
// ---------------------------------------------------------------------------

export interface SimulationClock {
  /** Current simulation time in seconds. */
  currentTime: number;
  /** Time step granularity in seconds. */
  tickSize: number;
  /** Total simulation horizon. */
  horizon: number;
}

// ---------------------------------------------------------------------------
// Event-Driven Simulation
// ---------------------------------------------------------------------------

export enum SimEventType {
  TASK_ARRIVE = 'TASK_ARRIVE',
  TASK_START = 'TASK_START',
  TASK_COMPLETE = 'TASK_COMPLETE',
  TASK_FAIL = 'TASK_FAIL',
  TASK_MIGRATE = 'TASK_MIGRATE',
  TASK_CHECKPOINT = 'TASK_CHECKPOINT',
  NODE_FAIL = 'NODE_FAIL',
  NODE_RECOVER = 'NODE_RECOVER',
  NETWORK_PARTITION = 'NETWORK_PARTITION',
  NETWORK_RECOVER = 'NETWORK_RECOVER',
  SCHEDULE_TICK = 'SCHEDULE_TICK',
  TRANSFER_COMPLETE = 'TRANSFER_COMPLETE',
  CONGESTION_SPIKE = 'CONGESTION_SPIKE',
}

export interface SimEvent {
  type: SimEventType;
  time: number;
  payload: Record<string, unknown>;
}
