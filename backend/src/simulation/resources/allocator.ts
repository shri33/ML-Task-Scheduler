/**
 * Resource Allocator with Hard Constraints
 * =========================================
 * Manages resource allocation across all compute nodes in the simulation.
 *
 * ## Design
 * Resources are tracked across five orthogonal dimensions:
 *   1. CPU cores
 *   2. Memory (MB)
 *   3. VRAM (MB) — critical for GPU/ML workloads
 *   4. Storage (MB)
 *   5. Network bandwidth (Mbps)
 *
 * All constraints are HARD: a task cannot be placed if ANY single
 * dimension would exceed the node's remaining capacity. This models
 * real fog/edge environments where, e.g., a Jetson Nano has ample CPU
 * but severely limited VRAM, making VRAM the binding constraint for
 * ML inference tasks.
 *
 * ## Atomicity
 * Allocations are tracked per-task in a nested Map:
 *   nodeId → (taskId → TaskRequirements)
 * This enables exact release on task completion/failure/migration and
 * prevents resource leaks. The allocate() method checks feasibility
 * and reserves atomically — no partial allocations can occur.
 *
 * ## Event Logging
 * Every allocate/release emits a ResourceEvent to an append-only log
 * for replay and debugging.
 */

import type { SimNode, TaskRequirements } from '../types';
import type {
  AllocationResult,
  UtilizationSnapshot,
  ResourceEvent,
} from './types';

// ---------------------------------------------------------------------------
// ResourceAllocator Class
// ---------------------------------------------------------------------------

export class ResourceAllocator {
  /**
   * Reference to the simulation's node map.
   * The allocator reads capacity and mutates usage fields.
   */
  private readonly nodes: Map<string, SimNode>;

  /**
   * Per-task allocations: nodeId → (taskId → requirements).
   * This is the authoritative record of which resources are held by
   * which tasks. On release, we look up the exact requirements here
   * rather than trusting the caller to pass correct values.
   */
  private readonly allocations: Map<string, Map<string, TaskRequirements>>;

  /**
   * Append-only event log for auditability and replay.
   */
  private readonly eventLog: ResourceEvent[] = [];

  /**
   * @param nodes Map of all simulation nodes. The allocator will mutate
   *              the `usage` field of each node on allocate/release.
   */
  constructor(nodes: Map<string, SimNode>) {
    this.nodes = nodes;
    this.allocations = new Map();

    // Initialize allocation maps for each known node
    for (const nodeId of nodes.keys()) {
      this.allocations.set(nodeId, new Map());
    }
  }

  // =========================================================================
  // Feasibility Check
  // =========================================================================

  /**
   * Checks whether a task's requirements can be satisfied by the
   * remaining capacity on a node.
   *
   * Each of the five resource dimensions is checked independently.
   * The FIRST violated constraint is reported in the reason field,
   * enabling the scheduler to make targeted re-placement decisions
   * (e.g., "insufficient VRAM" → search GPU nodes specifically).
   *
   * @param nodeId       Target node ID.
   * @param requirements Task resource requirements.
   * @returns            Feasibility result with optional failure reason.
   */
  public canAllocate(
    nodeId: string,
    requirements: TaskRequirements,
  ): { feasible: boolean; reason?: string } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { feasible: false, reason: `Node '${nodeId}' does not exist` };
    }

    if (!node.alive) {
      return { feasible: false, reason: `Node '${nodeId}' is not alive` };
    }

    const available = this.getAvailable(nodeId);

    // Check each dimension — report the first violation
    if (requirements.cpuCores > available.cpuCores) {
      return {
        feasible: false,
        reason: `Insufficient CPU: need ${requirements.cpuCores} cores, ` +
          `available ${available.cpuCores.toFixed(2)} of ${node.capacity.cpuCores}`,
      };
    }

    if (requirements.memoryMB > available.memoryMB) {
      return {
        feasible: false,
        reason: `Insufficient memory: need ${requirements.memoryMB} MB, ` +
          `available ${available.memoryMB.toFixed(2)} of ${node.capacity.memoryMB} MB`,
      };
    }

    if (requirements.vramMB > available.vramMB) {
      return {
        feasible: false,
        reason: `Insufficient VRAM: need ${requirements.vramMB} MB, ` +
          `available ${available.vramMB.toFixed(2)} of ${node.capacity.vramMB} MB`,
      };
    }

    if (requirements.storageMB > available.storageMB) {
      return {
        feasible: false,
        reason: `Insufficient storage: need ${requirements.storageMB} MB, ` +
          `available ${available.storageMB.toFixed(2)} of ${node.capacity.storageMB} MB`,
      };
    }

    if (requirements.bandwidthMbps > available.networkBandwidthMbps) {
      return {
        feasible: false,
        reason: `Insufficient bandwidth: need ${requirements.bandwidthMbps} Mbps, ` +
          `available ${available.networkBandwidthMbps.toFixed(2)} of ` +
          `${node.capacity.networkBandwidthMbps} Mbps`,
      };
    }

    return { feasible: true };
  }

  // =========================================================================
  // Allocation
  // =========================================================================

  /**
   * Atomically reserves resources for a task on a node.
   *
   * The method first checks feasibility, then updates the node's usage
   * counters and records the allocation in the per-task tracking map.
   * If feasibility fails, no state is mutated (atomic guarantee).
   *
   * @param nodeId       Target node ID.
   * @param taskId       Task requesting resources.
   * @param requirements Resources to reserve.
   * @param timestamp    Simulation time of allocation (for event log).
   * @returns            Whether the allocation succeeded.
   */
  public allocate(
    nodeId: string,
    taskId: string,
    requirements: TaskRequirements,
    timestamp: number = 0,
  ): boolean {
    const check = this.canAllocate(nodeId, requirements);
    if (!check.feasible) {
      return false;
    }

    const node = this.nodes.get(nodeId)!;

    // Reserve resources by incrementing usage
    node.usage.cpuCores += requirements.cpuCores;
    node.usage.memoryMB += requirements.memoryMB;
    node.usage.vramMB += requirements.vramMB;
    node.usage.storageMB += requirements.storageMB;
    node.usage.activeBandwidthMbps += requirements.bandwidthMbps;

    // Track per-task allocation
    let nodeAllocations = this.allocations.get(nodeId);
    if (!nodeAllocations) {
      nodeAllocations = new Map();
      this.allocations.set(nodeId, nodeAllocations);
    }
    nodeAllocations.set(taskId, { ...requirements });

    // Log event
    this.eventLog.push({
      type: 'allocate',
      nodeId,
      taskId,
      requirements: { ...requirements },
      timestamp,
    });

    return true;
  }

  // =========================================================================
  // Release
  // =========================================================================

  /**
   * Releases resources held by a task on a node.
   *
   * Looks up the exact requirements from the allocation tracking map
   * rather than trusting caller-provided values. This prevents subtle
   * bugs where a task's requirements were modified after allocation.
   *
   * If the task is not found in the allocation map (e.g., double-release),
   * this is a no-op to ensure idempotency.
   *
   * @param nodeId    Node from which to release resources.
   * @param taskId    Task whose resources to release.
   * @param timestamp Simulation time of release (for event log).
   */
  public release(
    nodeId: string,
    taskId: string,
    timestamp: number = 0,
  ): void {
    const nodeAllocations = this.allocations.get(nodeId);
    if (!nodeAllocations) {
      return; // Node not tracked — no-op
    }

    const requirements = nodeAllocations.get(taskId);
    if (!requirements) {
      return; // Task not allocated here — no-op (idempotent)
    }

    const node = this.nodes.get(nodeId);
    if (node) {
      // Return resources by decrementing usage
      // Clamp to 0 to avoid negative usage from floating-point drift
      node.usage.cpuCores = Math.max(
        0,
        node.usage.cpuCores - requirements.cpuCores,
      );
      node.usage.memoryMB = Math.max(
        0,
        node.usage.memoryMB - requirements.memoryMB,
      );
      node.usage.vramMB = Math.max(
        0,
        node.usage.vramMB - requirements.vramMB,
      );
      node.usage.storageMB = Math.max(
        0,
        node.usage.storageMB - requirements.storageMB,
      );
      node.usage.activeBandwidthMbps = Math.max(
        0,
        node.usage.activeBandwidthMbps - requirements.bandwidthMbps,
      );
    }

    // Remove from tracking
    nodeAllocations.delete(taskId);

    // Log event
    this.eventLog.push({
      type: 'release',
      nodeId,
      taskId,
      requirements: { ...requirements },
      timestamp,
    });
  }

  // =========================================================================
  // Capacity Queries
  // =========================================================================

  /**
   * Returns the remaining capacity on a node (capacity − usage).
   * All values are clamped to ≥ 0 to handle floating-point drift.
   *
   * @param nodeId Node to query.
   * @returns      Remaining capacity across all dimensions.
   * @throws       Error if the node does not exist.
   */
  public getAvailable(nodeId: string): {
    cpuCores: number;
    memoryMB: number;
    vramMB: number;
    storageMB: number;
    networkBandwidthMbps: number;
  } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' does not exist`);
    }

    return {
      cpuCores: Math.max(0, node.capacity.cpuCores - node.usage.cpuCores),
      memoryMB: Math.max(0, node.capacity.memoryMB - node.usage.memoryMB),
      vramMB: Math.max(0, node.capacity.vramMB - node.usage.vramMB),
      storageMB: Math.max(0, node.capacity.storageMB - node.usage.storageMB),
      networkBandwidthMbps: Math.max(
        0,
        node.capacity.networkBandwidthMbps - node.usage.activeBandwidthMbps,
      ),
    };
  }

  /**
   * Returns per-dimension utilization ratios (0–1+) for a node.
   * Values > 1 indicate oversubscription.
   *
   * Dimensions with zero capacity return 0 utilization (not Infinity)
   * to avoid NaN propagation in downstream calculations.
   *
   * @param nodeId Node to query.
   * @returns      Utilization ratios for each dimension.
   */
  public getUtilization(nodeId: string): {
    cpu: number;
    memory: number;
    vram: number;
    storage: number;
    bandwidth: number;
  } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' does not exist`);
    }

    return {
      cpu: node.capacity.cpuCores > 0
        ? node.usage.cpuCores / node.capacity.cpuCores
        : 0,
      memory: node.capacity.memoryMB > 0
        ? node.usage.memoryMB / node.capacity.memoryMB
        : 0,
      vram: node.capacity.vramMB > 0
        ? node.usage.vramMB / node.capacity.vramMB
        : 0,
      storage: node.capacity.storageMB > 0
        ? node.usage.storageMB / node.capacity.storageMB
        : 0,
      bandwidth: node.capacity.networkBandwidthMbps > 0
        ? node.usage.activeBandwidthMbps / node.capacity.networkBandwidthMbps
        : 0,
    };
  }

  /**
   * Checks whether any resource dimension on a node exceeds 100%.
   * This should never happen under normal operation (the allocator
   * prevents it), but can occur during migration races or manual
   * usage field manipulation.
   *
   * @param nodeId Node to check.
   * @returns      True if any dimension is oversubscribed.
   */
  public isOversubscribed(nodeId: string): boolean {
    const util = this.getUtilization(nodeId);
    return (
      util.cpu > 1 ||
      util.memory > 1 ||
      util.vram > 1 ||
      util.storage > 1 ||
      util.bandwidth > 1
    );
  }

  /**
   * Returns IDs of all nodes with at least `minVramMB` megabytes of
   * available VRAM. Used by GPU-aware schedulers to filter candidate
   * nodes before running more expensive placement algorithms.
   *
   * @param minVramMB Minimum required available VRAM in MB.
   * @returns         Array of node IDs meeting the VRAM threshold.
   */
  public getNodesByAvailableVRAM(minVramMB: number): string[] {
    const result: string[] = [];

    for (const [nodeId, node] of this.nodes) {
      if (!node.alive) {
        continue;
      }
      const availableVram = Math.max(
        0,
        node.capacity.vramMB - node.usage.vramMB,
      );
      if (availableVram >= minVramMB) {
        result.push(nodeId);
      }
    }

    return result;
  }

  // =========================================================================
  // Snapshot & Event Log
  // =========================================================================

  /**
   * Creates a utilization snapshot for a node at the given time.
   *
   * @param nodeId    Node to snapshot.
   * @param timestamp Simulation time.
   * @returns         Utilization snapshot.
   */
  public getUtilizationSnapshot(
    nodeId: string,
    timestamp: number,
  ): UtilizationSnapshot {
    const util = this.getUtilization(nodeId);
    return {
      nodeId,
      cpu: util.cpu,
      memory: util.memory,
      vram: util.vram,
      storage: util.storage,
      bandwidth: util.bandwidth,
      timestamp,
    };
  }

  /**
   * Returns all utilization snapshots for all alive nodes at the given time.
   *
   * @param timestamp Simulation time.
   * @returns         Array of snapshots, one per alive node.
   */
  public getAllUtilizationSnapshots(
    timestamp: number,
  ): UtilizationSnapshot[] {
    const snapshots: UtilizationSnapshot[] = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.alive) {
        snapshots.push(this.getUtilizationSnapshot(nodeId, timestamp));
      }
    }
    return snapshots;
  }

  /**
   * Returns the full event log. Useful for post-hoc analysis and
   * debugging resource allocation patterns.
   *
   * @returns Immutable copy of the event log.
   */
  public getEventLog(): readonly ResourceEvent[] {
    return this.eventLog;
  }

  /**
   * Returns the allocation result object for external consumption.
   *
   * @param success     Whether allocation succeeded.
   * @param nodeId      Target node.
   * @param taskId      Target task.
   * @param reason      Failure reason (if applicable).
   * @returns           Structured allocation result.
   */
  public static makeResult(
    success: boolean,
    nodeId: string,
    taskId: string,
    reason?: string,
  ): AllocationResult {
    return { success, nodeId, taskId, reason };
  }

  /**
   * Returns all task IDs currently allocated on a node.
   *
   * @param nodeId Node to query.
   * @returns      Array of task IDs.
   */
  public getAllocatedTasks(nodeId: string): string[] {
    const nodeAllocations = this.allocations.get(nodeId);
    if (!nodeAllocations) {
      return [];
    }
    return Array.from(nodeAllocations.keys());
  }

  /**
   * Returns the number of tasks currently allocated on a node.
   *
   * @param nodeId Node to query.
   * @returns      Number of allocated tasks.
   */
  public getAllocatedTaskCount(nodeId: string): number {
    const nodeAllocations = this.allocations.get(nodeId);
    return nodeAllocations ? nodeAllocations.size : 0;
  }
}
