/**
 * Failure Modeling Engine
 * =======================
 * Simulates realistic failures in a fog computing environment:
 *   - Node crashes (exponential inter-arrival times, MTTF-based)
 *   - Network partitions (isolate subgraphs)
 *   - Packet loss spikes (temporary quality degradation)
 *   - GPU OOM (VRAM exhaustion on GPU tasks)
 *   - Task timeouts (deadline violations)
 *   - Congestion storms (cascading bandwidth collapse)
 *
 * Each failure type uses configurable probability distributions.
 * The injector produces SimEvent objects consumed by the simulation engine.
 */

import {
  SimNode,
  SimTask,
  SimEvent,
  SimEventType,
  FailureConfig,
  TaskState,
} from '../types';
import { exponentialRandom, mulberry32 } from '../config';

// ---------------------------------------------------------------------------
// Failure Event Generator
// ---------------------------------------------------------------------------

export interface FailureSchedule {
  /** Time at which this failure occurs (simulation seconds). */
  time: number;
  /** Type of failure. */
  type: FailureType;
  /** Affected entity ID (node ID, link key, or task ID). */
  targetId: string;
  /** Duration of the failure in seconds. */
  duration: number;
  /** Additional parameters. */
  params: Record<string, unknown>;
}

export enum FailureType {
  NODE_CRASH = 'NODE_CRASH',
  NETWORK_PARTITION = 'NETWORK_PARTITION',
  PACKET_LOSS_SPIKE = 'PACKET_LOSS_SPIKE',
  BANDWIDTH_COLLAPSE = 'BANDWIDTH_COLLAPSE',
  GPU_OOM = 'GPU_OOM',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  CONGESTION_STORM = 'CONGESTION_STORM',
}

/**
 * Generates a complete failure schedule for a simulation run.
 *
 * Uses exponential inter-arrival times per failure type, parameterized
 * by the MTTF/rate fields in FailureConfig.
 */
export function generateFailureSchedule(
  config: FailureConfig,
  nodes: Map<string, SimNode>,
  horizon: number,
  seed: number,
): FailureSchedule[] {
  if (!config.enabled) return [];

  const rng = mulberry32(seed);
  const schedule: FailureSchedule[] = [];
  const nodeIds = Array.from(nodes.keys());

  // --- Node failures ---
  if (config.nodeFailureRate > 0) {
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      const mttf = node.mttf || config.globalMttf || 3600;
      const mttr = node.mttr || config.globalMttr || 120;
      let t = exponentialRandom(rng, 1 / mttf);

      while (t < horizon) {
        const duration = Math.max(10, exponentialRandom(rng, 1 / mttr));
        schedule.push({
          time: t,
          type: FailureType.NODE_CRASH,
          targetId: nodeId,
          duration,
          params: { mttf, mttr },
        });
        // Next failure after recovery + next inter-arrival
        t += duration + exponentialRandom(rng, 1 / mttf);
      }
    }
  }

  // --- Network partitions ---
  if (config.partitionRate > 0 && nodeIds.length >= 4) {
    const meanInterArrival = 1 / config.partitionRate;
    let t = exponentialRandom(rng, config.partitionRate);

    while (t < horizon) {
      // Partition isolates a random subset of nodes
      const partitionSize = Math.max(1, Math.floor(rng() * nodeIds.length * 0.3));
      const shuffled = [...nodeIds].sort(() => rng() - 0.5);
      const partitionedNodes = shuffled.slice(0, partitionSize);
      const duration = 10 + rng() * 300; // 10s–310s

      schedule.push({
        time: t,
        type: FailureType.NETWORK_PARTITION,
        targetId: partitionedNodes.join(','),
        duration,
        params: { nodeCount: partitionSize },
      });

      t += exponentialRandom(rng, config.partitionRate);
    }
  }

  // --- Packet loss spikes ---
  if (config.packetLossSpikeRate > 0) {
    let t = exponentialRandom(rng, config.packetLossSpikeRate);

    while (t < horizon) {
      const affectedNode = nodeIds[Math.floor(rng() * nodeIds.length)];
      const spikeMultiplier = 5 + rng() * 20; // 5x–25x normal loss
      const duration = 5 + rng() * 60; // 5s–65s

      schedule.push({
        time: t,
        type: FailureType.PACKET_LOSS_SPIKE,
        targetId: affectedNode,
        duration,
        params: { spikeMultiplier },
      });

      t += exponentialRandom(rng, config.packetLossSpikeRate);
    }
  }

  // --- Congestion storms ---
  {
    const stormRate = config.packetLossSpikeRate * 0.5; // less frequent than loss spikes
    if (stormRate > 0) {
      let t = exponentialRandom(rng, stormRate);

      while (t < horizon) {
        const epicenterNode = nodeIds[Math.floor(rng() * nodeIds.length)];
        const duration = 30 + rng() * 120; // 30s–150s
        const severity = 0.5 + rng() * 0.5; // utilization forced to 50-100%

        schedule.push({
          time: t,
          type: FailureType.CONGESTION_STORM,
          targetId: epicenterNode,
          duration,
          params: { severity },
        });

        t += exponentialRandom(rng, stormRate);
      }
    }
  }

  // Sort by time
  schedule.sort((a, b) => a.time - b.time);
  return schedule;
}

// ---------------------------------------------------------------------------
// Failure Application
// ---------------------------------------------------------------------------

/**
 * Apply a node crash: mark node as dead, fail all running tasks on it.
 * Returns SimEvents for the crash and per-task failures.
 */
export function applyNodeCrash(
  node: SimNode,
  runningTasks: SimTask[],
  time: number,
): SimEvent[] {
  const events: SimEvent[] = [];

  node.alive = false;
  events.push({
    type: SimEventType.NODE_FAIL,
    time,
    payload: { nodeId: node.id, reason: 'NODE_CRASH' },
  });

  for (const task of runningTasks) {
    if (task.assignedNodeId === node.id && task.state === TaskState.EXECUTING) {
      if (task.checkpointable) {
        task.state = TaskState.CHECKPOINTED;
        events.push({
          type: SimEventType.TASK_CHECKPOINT,
          time,
          payload: { taskId: task.id, nodeId: node.id },
        });
      } else {
        task.state = TaskState.FAILED;
        task.endTime = time;
        events.push({
          type: SimEventType.TASK_FAIL,
          time,
          payload: { taskId: task.id, nodeId: node.id, reason: 'NODE_CRASH' },
        });
      }
    }
  }

  return events;
}

/**
 * Recover a node after repair.
 */
export function applyNodeRecovery(node: SimNode, time: number): SimEvent {
  node.alive = true;
  node.upSince = time;
  // Reset usage to zero — all tasks were failed/checkpointed
  node.usage = {
    cpuCores: 0,
    memoryMB: 0,
    vramMB: 0,
    storageMB: 0,
    activeBandwidthMbps: 0,
  };

  return {
    type: SimEventType.NODE_RECOVER,
    time,
    payload: { nodeId: node.id },
  };
}

// ---------------------------------------------------------------------------
// Retry Policy
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxRetries: number;
  baseDelaySec: number;
  maxDelaySec: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelaySec: 2,
  maxDelaySec: 120,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

/**
 * Calculate the delay before the next retry using exponential backoff + jitter.
 *
 * delay = min(maxDelay, base * multiplier^attempt) * (1 ± jitter)
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy,
  rng: () => number,
): number {
  const rawDelay = policy.baseDelaySec * Math.pow(policy.backoffMultiplier, attempt);
  const capped = Math.min(rawDelay, policy.maxDelaySec);
  const jitter = 1 + (rng() * 2 - 1) * policy.jitterFactor;
  return capped * jitter;
}

/**
 * Determine whether a failed task should be retried.
 */
export function shouldRetry(task: SimTask, policy: RetryPolicy): boolean {
  return task.retryCount < policy.maxRetries;
}

// ---------------------------------------------------------------------------
// GPU OOM Detection
// ---------------------------------------------------------------------------

/**
 * Check if a GPU task will OOM on a node given current VRAM usage.
 * Returns true if the task requires more VRAM than available.
 */
export function willGpuOom(
  requiredVramMB: number,
  availableVramMB: number,
  oomProbability: number,
  rng: () => number,
): boolean {
  // Hard constraint: definitely OOM if insufficient VRAM
  if (requiredVramMB > availableVramMB) return true;

  // Soft constraint: stochastic OOM even when VRAM looks sufficient
  // (models memory fragmentation, runtime VRAM spikes, etc.)
  const usageRatio = requiredVramMB / Math.max(1, availableVramMB);
  const adjustedProbability = oomProbability * (usageRatio > 0.9 ? 3 : 1);
  return rng() < adjustedProbability;
}

// ---------------------------------------------------------------------------
// Checkpoint / Restart
// ---------------------------------------------------------------------------

export interface CheckpointState {
  taskId: string;
  nodeId: string;
  /** Fraction of execution completed at checkpoint time (0–1). */
  progressFraction: number;
  /** Simulation time of the checkpoint. */
  checkpointTime: number;
  /** Size of the checkpoint data in MB. */
  checkpointSizeMB: number;
}

/**
 * Create a checkpoint for a running task.
 * Checkpoint size scales with task data size and progress.
 */
export function createCheckpoint(
  task: SimTask,
  currentTime: number,
): CheckpointState {
  const elapsedExec = currentTime - task.startTime - task.queueWaitTime - task.transferTime;
  const progressFraction = Math.min(1, Math.max(0,
    elapsedExec / Math.max(0.001, task.estimatedExecTime),
  ));

  return {
    taskId: task.id,
    nodeId: task.assignedNodeId!,
    progressFraction,
    checkpointTime: currentTime,
    // Checkpoint size = fraction of data * compression factor (0.3)
    checkpointSizeMB: task.dataSizeMB * progressFraction * 0.3,
  };
}

/**
 * Calculate the remaining execution time after restoring from a checkpoint.
 */
export function remainingTimeAfterRestore(
  originalExecTime: number,
  checkpoint: CheckpointState,
  restoreOverheadSec: number,
): number {
  const remaining = originalExecTime * (1 - checkpoint.progressFraction);
  return remaining + restoreOverheadSec;
}
