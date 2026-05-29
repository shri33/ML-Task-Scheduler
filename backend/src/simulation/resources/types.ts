/**
 * Resource Subsystem Types
 * ========================
 * Types specific to the resource allocation and tracking subsystem.
 * These extend the core simulation types with allocation tracking,
 * utilization snapshots for time-series analysis, and resource events
 * for audit logging and replay.
 *
 * Research context: Fine-grained resource tracking across five dimensions
 * (CPU, memory, VRAM, storage, bandwidth) enables realistic modeling of
 * heterogeneous fog nodes where any single bottleneck dimension can
 * prevent task placement — unlike cloud simulators that often reduce
 * resources to a single scalar "capacity" value.
 */

import type { TaskRequirements } from '../types';

// ---------------------------------------------------------------------------
// Allocation Result
// ---------------------------------------------------------------------------

/**
 * Outcome of a resource allocation attempt.
 * Carries a human-readable reason on failure so the scheduler can make
 * informed re-placement decisions (e.g., "insufficient VRAM" triggers
 * a search for GPU-equipped nodes specifically).
 */
export interface AllocationResult {
  /** Whether resources were successfully reserved. */
  success: boolean;
  /** Target node ID for this allocation attempt. */
  nodeId: string;
  /** Task ID being allocated. */
  taskId: string;
  /** Human-readable reason for failure (undefined on success). */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Utilization Snapshot
// ---------------------------------------------------------------------------

/**
 * Point-in-time utilization snapshot for a single node.
 * Each dimension is normalized to [0, 1] where 1 = fully utilized.
 * Values > 1 indicate oversubscription (a constraint violation that
 * the allocator should prevent but may occur during migration races).
 *
 * These snapshots feed into time-series plots and Jain's fairness
 * index computations across the cluster.
 */
export interface UtilizationSnapshot {
  /** Node this snapshot belongs to. */
  nodeId: string;
  /** CPU utilization ratio (0–1+). */
  cpu: number;
  /** Memory utilization ratio (0–1+). */
  memory: number;
  /** VRAM utilization ratio (0–1+). */
  vram: number;
  /** Storage utilization ratio (0–1+). */
  storage: number;
  /** Bandwidth utilization ratio (0–1+). */
  bandwidth: number;
  /** Simulation time at which this snapshot was taken. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Resource Event
// ---------------------------------------------------------------------------

/** Discriminated union tag for resource events. */
export type ResourceEventType = 'allocate' | 'release';

/**
 * An immutable record of a resource allocation or release event.
 * These events form an append-only log that can be replayed to
 * reconstruct any historical resource state — useful for debugging
 * scheduling anomalies and for post-hoc analysis of resource
 * fragmentation patterns.
 */
export interface ResourceEvent {
  /** Whether resources were allocated or released. */
  type: ResourceEventType;
  /** Node on which the event occurred. */
  nodeId: string;
  /** Task whose resources changed. */
  taskId: string;
  /** The resource requirements that were allocated or released. */
  requirements: TaskRequirements;
  /** Simulation time of the event. */
  timestamp: number;
}
