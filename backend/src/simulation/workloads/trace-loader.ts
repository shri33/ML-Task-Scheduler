/**
 * Workload Trace Loaders
 * ======================
 * Loads real-world cluster traces and normalizes them into SimTask arrays.
 *
 * Supported trace formats:
 *   1. Google Cluster Trace (2011/2019) — CSV with job/task events
 *   2. Alibaba Cluster Trace (2018) — CSV with container/batch jobs
 *   3. Azure Functions Trace (2019) — CSV with serverless invocations
 *   4. Synthetic workloads (parameterized distributions)
 *
 * All loaders output a normalized SimTask[] sorted by submitTime.
 */

import { SimTask, TaskState, TaskRequirements } from '../types';
import { mulberry32, logNormalRandom, exponentialRandom, gaussianRandom } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// CSV Parser (minimal, no external dependency)
// ---------------------------------------------------------------------------

interface CsvRow {
  [key: string]: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
    const row: CsvRow = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Google Cluster Trace Loader
// ---------------------------------------------------------------------------

/**
 * Google Cluster Trace format (2011 version):
 * Columns: timestamp, missing_info, job_id, task_index, machine_id,
 *          event_type, user, scheduling_class, priority,
 *          cpu_request, memory_request, disk_space_request, different_machine_constraint
 *
 * We extract SUBMIT events (event_type=0) and use cpu/memory requests
 * as resource requirements.
 */
export interface GoogleTraceConfig {
  filePath: string;
  /** Scale factor for task count (e.g. 0.1 = use 10% of trace). */
  scaleFactor: number;
  /** Time offset to shift all timestamps. */
  timeOffsetSec: number;
  /** Scale CPU requests to simulation units. */
  cpuScaleFactor: number;
  /** Scale memory requests to simulation MB. */
  memoryScaleFactor: number;
  /** Assign tasks to node IDs from this array (round-robin). */
  nodeIds: string[];
  seed: number;
}

export function loadGoogleTrace(config: GoogleTraceConfig): SimTask[] {
  const content = fs.readFileSync(config.filePath, 'utf-8');
  const rows = parseCsv(content);
  const rng = mulberry32(config.seed);
  const tasks: SimTask[] = [];

  // Filter for SUBMIT events (event_type = 0)
  const submitEvents = rows.filter((r) => r.event_type === '0' || r.event_type === 'SUBMIT');

  const sampleSize = Math.floor(submitEvents.length * config.scaleFactor);
  // Reservoir sampling for scaleFactor < 1
  const sampled = reservoirSample(submitEvents, sampleSize, rng);

  for (let i = 0; i < sampled.length; i++) {
    const row = sampled[i];
    const cpuReq = parseFloat(row.cpu_request || row['cpu_request'] || '0.1');
    const memReq = parseFloat(row.memory_request || row['memory_request'] || '0.01');
    const timestamp = parseFloat(row.timestamp || '0') / 1_000_000; // microseconds to seconds
    const priority = parseInt(row.priority || '0', 10);

    const originNode = config.nodeIds[i % config.nodeIds.length];

    tasks.push(createTaskFromTrace({
      id: `google-${row.job_id || i}-${row.task_index || 0}`,
      submitTime: timestamp * config.timeOffsetSec + config.timeOffsetSec,
      cpuCores: Math.max(1, Math.round(cpuReq * config.cpuScaleFactor)),
      memoryMB: Math.max(64, Math.round(memReq * config.memoryScaleFactor)),
      priority: Math.min(5, Math.max(1, priority + 1)),
      originNodeId: originNode,
      rng,
    }));
  }

  return tasks.sort((a, b) => a.submitTime - b.submitTime);
}

// ---------------------------------------------------------------------------
// Alibaba Cluster Trace Loader
// ---------------------------------------------------------------------------

/**
 * Alibaba Cluster Trace (2018) — batch_task table:
 * Columns: task_name, instance_num, job_name, task_type, status,
 *          start_time, end_time, plan_cpu, plan_mem, plan_gpu
 */
export interface AlibabaTraceConfig {
  filePath: string;
  scaleFactor: number;
  nodeIds: string[];
  seed: number;
}

export function loadAlibabaTrace(config: AlibabaTraceConfig): SimTask[] {
  const content = fs.readFileSync(config.filePath, 'utf-8');
  const rows = parseCsv(content);
  const rng = mulberry32(config.seed);
  const tasks: SimTask[] = [];

  const sampleSize = Math.floor(rows.length * config.scaleFactor);
  const sampled = reservoirSample(rows, sampleSize, rng);

  for (let i = 0; i < sampled.length; i++) {
    const row = sampled[i];
    const planCpu = parseFloat(row.plan_cpu || '100') / 100; // Alibaba uses centcores
    const planMem = parseFloat(row.plan_mem || '0.01');
    const planGpu = parseFloat(row.plan_gpu || '0') / 100;
    const startTime = parseFloat(row.start_time || '0');
    const endTime = parseFloat(row.end_time || '0');
    const actualDuration = endTime > startTime ? endTime - startTime : 0;

    const originNode = config.nodeIds[i % config.nodeIds.length];

    const task = createTaskFromTrace({
      id: `alibaba-${row.task_name || i}`,
      submitTime: startTime,
      cpuCores: Math.max(1, Math.round(planCpu)),
      memoryMB: Math.max(64, Math.round(planMem * 32768)), // fraction of 32GB
      priority: parseTaskPriority(row.task_type),
      originNodeId: originNode,
      rng,
    });

    // Use actual duration from trace if available
    if (actualDuration > 0) {
      task.estimatedExecTime = actualDuration;
      task.actualExecTime = actualDuration;
    }

    // GPU tasks
    if (planGpu > 0) {
      task.requirements.vramMB = Math.round(planGpu * 8192); // fraction of 8GB GPU
    }

    tasks.push(task);
  }

  return tasks.sort((a, b) => a.submitTime - b.submitTime);
}

// ---------------------------------------------------------------------------
// Azure Functions Trace Loader
// ---------------------------------------------------------------------------

/**
 * Azure Functions Trace (2019):
 * Columns: app, func, end_timestamp, duration, ... (invocation records)
 *
 * These are short-lived serverless invocations. We map them to edge/fog tasks.
 */
export interface AzureTraceConfig {
  filePath: string;
  scaleFactor: number;
  nodeIds: string[];
  seed: number;
}

export function loadAzureTrace(config: AzureTraceConfig): SimTask[] {
  const content = fs.readFileSync(config.filePath, 'utf-8');
  const rows = parseCsv(content);
  const rng = mulberry32(config.seed);
  const tasks: SimTask[] = [];

  const sampleSize = Math.floor(rows.length * config.scaleFactor);
  const sampled = reservoirSample(rows, sampleSize, rng);

  for (let i = 0; i < sampled.length; i++) {
    const row = sampled[i];
    const durationMs = parseFloat(row.duration || '100');
    const endTimestamp = parseFloat(row.end_timestamp || '0');
    const submitTime = endTimestamp - durationMs / 1000;

    const originNode = config.nodeIds[i % config.nodeIds.length];

    const task = createTaskFromTrace({
      id: `azure-${row.app || 'app'}-${row.func || 'fn'}-${i}`,
      submitTime: Math.max(0, submitTime),
      cpuCores: 1, // serverless functions are typically single-core
      memoryMB: 128 + Math.round(rng() * 384), // 128-512 MB
      priority: 3,
      originNodeId: originNode,
      rng,
    });

    task.estimatedExecTime = durationMs / 1000; // ms to seconds
    task.actualExecTime = durationMs / 1000;
    // Small data footprint for serverless
    task.dataSizeMB = 0.1 + rng() * 5;

    tasks.push(task);
  }

  return tasks.sort((a, b) => a.submitTime - b.submitTime);
}

// ---------------------------------------------------------------------------
// Synthetic Workload Generator
// ---------------------------------------------------------------------------

export interface SyntheticWorkloadConfig {
  taskCount: number;
  /** Node IDs to assign as origin nodes. */
  nodeIds: string[];
  /** Arrival distribution: 'poisson' | 'uniform' | 'burst'. */
  arrivalPattern: 'poisson' | 'uniform' | 'burst';
  /** Mean inter-arrival time (seconds). */
  meanInterArrival: number;
  /** Fraction of tasks that are GPU tasks (0–1). */
  gpuTaskFraction: number;
  /** Fraction of tasks with dependencies (DAG fraction). */
  dagFraction: number;
  /** Mean execution time in seconds. */
  meanExecTime: number;
  /** Coefficient of variation for execution time. */
  execTimeCv: number;
  /** Mean data size in MB. */
  meanDataSizeMB: number;
  /** Maximum number of dependencies per task. */
  maxDepsPerTask: number;
  seed: number;
}

export const DEFAULT_SYNTHETIC_CONFIG: SyntheticWorkloadConfig = {
  taskCount: 100,
  nodeIds: [],
  arrivalPattern: 'poisson',
  meanInterArrival: 1.0,
  gpuTaskFraction: 0.1,
  dagFraction: 0.0,
  meanExecTime: 10.0,
  execTimeCv: 0.8,
  meanDataSizeMB: 50,
  maxDepsPerTask: 3,
  seed: 42,
};

export function generateSyntheticWorkload(config: SyntheticWorkloadConfig): SimTask[] {
  const rng = mulberry32(config.seed);
  const tasks: SimTask[] = [];
  let currentTime = 0;

  // Calculate log-normal parameters from mean and CV
  const sigma2 = Math.log(1 + config.execTimeCv * config.execTimeCv);
  const mu = Math.log(config.meanExecTime) - sigma2 / 2;
  const sigma = Math.sqrt(sigma2);

  for (let i = 0; i < config.taskCount; i++) {
    // Generate arrival time
    switch (config.arrivalPattern) {
      case 'poisson':
        currentTime += exponentialRandom(rng, 1 / config.meanInterArrival);
        break;
      case 'uniform':
        currentTime += config.meanInterArrival * (0.5 + rng());
        break;
      case 'burst':
        // Bursty: alternate between high and low arrival rates
        if (Math.floor(currentTime / 60) % 2 === 0) {
          currentTime += exponentialRandom(rng, 5 / config.meanInterArrival); // 5x faster
        } else {
          currentTime += exponentialRandom(rng, 0.2 / config.meanInterArrival); // 5x slower
        }
        break;
    }

    const isGpu = rng() < config.gpuTaskFraction;
    const execTime = logNormalRandom(rng, mu, sigma);
    const dataSizeMB = Math.max(0.1, logNormalRandom(rng, Math.log(config.meanDataSizeMB), 0.8));
    const priority = Math.floor(rng() * 5) + 1;
    const originNode = config.nodeIds.length > 0
      ? config.nodeIds[Math.floor(rng() * config.nodeIds.length)]
      : `node-${Math.floor(rng() * 10)}`;

    const cpuCores = isGpu ? Math.floor(1 + rng() * 4) : Math.floor(1 + rng() * 8);
    const memoryMB = isGpu ? 4096 + Math.floor(rng() * 12288) : 256 + Math.floor(rng() * 3840);
    const vramMB = isGpu ? 1024 + Math.floor(rng() * 7168) : 0;

    const task: SimTask = {
      id: `task-${i}`,
      name: `Task ${i}`,
      originNodeId: originNode,
      category: isGpu ? 1 : 0,
      requirements: {
        cpuCores,
        memoryMB,
        vramMB,
        storageMB: Math.floor(dataSizeMB * 2),
        bandwidthMbps: 10 + Math.floor(rng() * 90),
      },
      dataSizeMB,
      estimatedExecTime: execTime,
      actualExecTime: execTime * (0.8 + rng() * 0.4), // ±20% variance
      deadline: currentTime + execTime * (2 + rng() * 3), // 2–5x execution time
      priority,
      state: TaskState.WAITING,
      assignedNodeId: null,
      dependencies: [],
      retryCount: 0,
      maxRetries: 3,
      checkpointable: rng() < 0.3, // 30% of tasks support checkpointing
      migrationCostSec: execTime * 0.1, // 10% of exec time
      submitTime: currentTime,
      startTime: 0,
      endTime: 0,
      queueWaitTime: 0,
      transferTime: 0,
    };

    tasks.push(task);
  }

  // Generate DAG dependencies
  if (config.dagFraction > 0) {
    const dagTaskCount = Math.floor(tasks.length * config.dagFraction);
    // Create DAG structure: later tasks depend on earlier tasks
    for (let i = 1; i < dagTaskCount; i++) {
      const numDeps = Math.min(i, Math.floor(rng() * config.maxDepsPerTask) + 1);
      const depIndices = new Set<number>();
      while (depIndices.size < numDeps) {
        depIndices.add(Math.floor(rng() * i));
      }
      tasks[i].dependencies = Array.from(depIndices).map((idx) => tasks[idx].id);
    }
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// Unified Workload Loader
// ---------------------------------------------------------------------------

export type WorkloadSource = 'synthetic' | 'google-trace' | 'alibaba-trace' | 'azure-trace';

export function loadWorkload(
  source: WorkloadSource,
  nodeIds: string[],
  taskCount: number,
  seed: number,
  tracePath?: string,
): SimTask[] {
  switch (source) {
    case 'google-trace':
      if (!tracePath) throw new Error('tracePath required for google-trace');
      return loadGoogleTrace({
        filePath: tracePath,
        scaleFactor: Math.min(1, taskCount / 10000),
        timeOffsetSec: 0,
        cpuScaleFactor: 8,
        memoryScaleFactor: 32768,
        nodeIds,
        seed,
      });

    case 'alibaba-trace':
      if (!tracePath) throw new Error('tracePath required for alibaba-trace');
      return loadAlibabaTrace({
        filePath: tracePath,
        scaleFactor: Math.min(1, taskCount / 10000),
        nodeIds,
        seed,
      });

    case 'azure-trace':
      if (!tracePath) throw new Error('tracePath required for azure-trace');
      return loadAzureTrace({
        filePath: tracePath,
        scaleFactor: Math.min(1, taskCount / 10000),
        nodeIds,
        seed,
      });

    case 'synthetic':
    default:
      return generateSyntheticWorkload({
        ...DEFAULT_SYNTHETIC_CONFIG,
        taskCount,
        nodeIds,
        seed,
      });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTaskFromTrace(params: {
  id: string;
  submitTime: number;
  cpuCores: number;
  memoryMB: number;
  priority: number;
  originNodeId: string;
  rng: () => number;
}): SimTask {
  const { rng } = params;
  const dataSizeMB = 1 + rng() * 200;
  const execTime = 0.5 + logNormalRandom(rng, 2, 1.5); // seconds

  return {
    id: params.id,
    name: params.id,
    originNodeId: params.originNodeId,
    category: 0,
    requirements: {
      cpuCores: params.cpuCores,
      memoryMB: params.memoryMB,
      vramMB: 0,
      storageMB: Math.round(dataSizeMB * 2),
      bandwidthMbps: 10,
    },
    dataSizeMB,
    estimatedExecTime: execTime,
    actualExecTime: execTime * (0.8 + rng() * 0.4),
    deadline: params.submitTime + execTime * 5,
    priority: params.priority,
    state: TaskState.WAITING,
    assignedNodeId: null,
    dependencies: [],
    retryCount: 0,
    maxRetries: 3,
    checkpointable: rng() < 0.2,
    migrationCostSec: execTime * 0.1,
    submitTime: params.submitTime,
    startTime: 0,
    endTime: 0,
    queueWaitTime: 0,
    transferTime: 0,
  };
}

function parseTaskPriority(taskType: string | undefined): number {
  switch (taskType) {
    case '0': return 3; // batch
    case '1': return 4; // interactive
    case '2': return 5; // production
    default: return 2;
  }
}

/**
 * Reservoir sampling: select k items uniformly at random from a stream.
 * O(n) time, O(k) space.
 */
function reservoirSample<T>(items: T[], k: number, rng: () => number): T[] {
  if (k >= items.length) return [...items];

  const reservoir = items.slice(0, k);
  for (let i = k; i < items.length; i++) {
    const j = Math.floor(rng() * (i + 1));
    if (j < k) {
      reservoir[j] = items[i];
    }
  }
  return reservoir;
}
