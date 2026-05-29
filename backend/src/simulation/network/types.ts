/**
 * Network Simulation Types
 * ========================
 * Types specific to the network transfer simulation subsystem.
 *
 * These types capture the result of simulating a data transfer across
 * a multi-hop fog computing network, including path details, congestion
 * state, and link-level utilization snapshots.
 *
 * Separated from the core types to keep concerns modular: core types
 * define the topology and link model; these types describe simulation
 * *outputs* (transfer results, utilization snapshots).
 */

/**
 * Result of simulating a data transfer between two nodes.
 *
 * Includes the computed transfer time (accounting for serialization,
 * propagation, queueing, and retransmission delays), the path taken,
 * and whether any link along the path was congested.
 */
export interface TransferResult {
  /** Total transfer time in seconds (includes all delay components). */
  transferTimeSec: number;
  /** Sum of per-hop propagation latencies in milliseconds (no queueing). */
  pathLatencyMs: number;
  /** Minimum bandwidth along the path in Mbps (bottleneck link). */
  bottleneckBandwidthMbps: number;
  /** Ordered list of node IDs forming the path (source → target). */
  path: string[];
  /** Number of hops (path.length - 1). */
  hops: number;
  /** True if any link on the path had utilization > 0.8. */
  congested: boolean;
}

/**
 * A point-in-time snapshot of network-wide utilization.
 *
 * Used for metrics collection and visualization. Each snapshot
 * records per-link utilization, aggregate statistics, and the
 * count of congested links (utilization > 0.8).
 */
export interface NetworkSnapshot {
  /** Per-link utilization keyed by "sourceId->targetId". */
  linkUtilizations: Map<string, number>;
  /** Average utilization across all links (0–1). */
  avgUtilization: number;
  /** Number of links with utilization > 0.8. */
  congestionCount: number;
}
