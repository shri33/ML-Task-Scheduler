/**
 * Network Transfer Simulator
 * ==========================
 * Computes realistic data transfer times across multi-hop fog computing
 * topologies. Replaces the naive `dataSize / bandwidth` formula with a
 * model that accounts for:
 *
 *   1. **Propagation delay** — base link latency + Gaussian jitter.
 *   2. **Serialization delay** — time to push a packet onto the wire,
 *      proportional to packetSize / bandwidth.
 *   3. **Queueing delay** — M/M/1 model: Wq = ρ / (μ(1 − ρ)),
 *      where ρ = arrival rate / service rate = link utilization.
 *   4. **Retransmission penalty** — if a packet is lost (Bernoulli trial
 *      with link's packetLossRate), add one RTT per lost packet.
 *   5. **Congestion penalty** — when utilization > 0.8, multiply delay
 *      by the link's congestionFactor.
 *
 * For bulk transfers, total time = dataSizeMB / effectiveBandwidth + propagation.
 *
 * References:
 *   - M/M/1 queue: Kleinrock, "Queueing Systems, Vol. I", 1975, Ch. 3
 *   - Network delay decomposition: Kurose & Ross, "Computer Networking:
 *     A Top-Down Approach", 8th ed., §1.4
 */

import { TopologyGraph } from '../topology/graph';
import { gaussianRandom } from '../topology/generators';
import { TransferResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default packet size in bytes.
 * Standard Ethernet MTU minus IP + TCP headers (1500 - 40 = 1460).
 */
const DEFAULT_PACKET_SIZE_BYTES = 1460;

/**
 * Congestion threshold: links with utilization above this value incur
 * the congestion penalty.
 */
const CONGESTION_THRESHOLD = 0.8;

/**
 * Maximum utilization for M/M/1 stability. The M/M/1 model diverges
 * at ρ = 1; we cap it to avoid Infinity in calculations.
 */
const MAX_UTILIZATION_FOR_MM1 = 0.98;

// ---------------------------------------------------------------------------
// Per-hop delay computation
// ---------------------------------------------------------------------------

/**
 * Compute the one-way delay for a single hop between two adjacent nodes.
 *
 * Delay components:
 *   propagation = latencyMs + N(0, jitterMs)
 *   serialization = (packetSize_bits) / (bandwidth_bps) * 1000 ms
 *   queueing = M/M/1: ρ / (μ(1−ρ)) converted to ms
 *   retransmission = if lost: extra RTT ≈ 2 * propagation
 *
 * @param latencyMs     Base propagation latency in ms.
 * @param jitterMs      Jitter std dev in ms (Gaussian).
 * @param bandwidthMbps Link capacity in Mbps.
 * @param utilization   Current link utilization (0–1).
 * @param packetLossRate Baseline loss probability (0–1).
 * @param congestionFactor Multiplier applied when utilization > 0.8.
 * @param rng           Seeded PRNG function.
 * @returns Per-hop delay in milliseconds.
 */
function computeHopDelay(
  latencyMs: number,
  jitterMs: number,
  bandwidthMbps: number,
  utilization: number,
  packetLossRate: number,
  congestionFactor: number,
  rng: () => number
): number {
  // 1. Propagation delay with Gaussian jitter
  //    Clamp to >= 0 since negative delays are physically impossible.
  const jitter = jitterMs > 0 ? gaussianRandom(rng, 0, jitterMs) : 0;
  const propagation = Math.max(0, latencyMs + jitter);

  // 2. Serialization delay
  //    Time to push one packet onto the wire:
  //    t_ser = packet_size_bits / link_rate_bps
  //    Convert: bandwidthMbps * 1e6 = bps; packetSize * 8 = bits
  //    Result in ms: (bits / bps) * 1000
  const packetBits = DEFAULT_PACKET_SIZE_BYTES * 8;
  const linkBps = bandwidthMbps * 1e6;
  const serialization = linkBps > 0 ? (packetBits / linkBps) * 1000 : Infinity;

  // 3. Queueing delay — M/M/1 model
  //    In M/M/1: E[Wq] = ρ / (μ(1 − ρ))
  //    where μ is the service rate = link_rate / packet_size (packets/ms)
  //    and ρ = utilization (= λ/μ).
  //    E[Wq] in ms = ρ / (μ_ms * (1 − ρ))
  const rho = Math.min(utilization, MAX_UTILIZATION_FOR_MM1);
  let queueing = 0;
  if (rho > 0 && linkBps > 0) {
    // Service rate in packets per millisecond
    const muPerMs = linkBps / packetBits / 1000;
    queueing = rho / (muPerMs * (1 - rho));
  }

  // 4. Retransmission penalty
  //    If a packet is lost, we assume a stop-and-wait retransmission
  //    that costs one additional RTT ≈ 2 * propagation.
  let retransmission = 0;
  if (packetLossRate > 0 && rng() < packetLossRate) {
    retransmission = 2 * propagation;
  }

  // Total per-hop delay
  let total = propagation + serialization + queueing + retransmission;

  // 5. Congestion penalty: multiply entire hop delay by congestionFactor
  if (utilization > CONGESTION_THRESHOLD) {
    total *= congestionFactor;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Transfer time calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the total time to transfer data from one node to another
 * across the topology.
 *
 * For small transfers (< 1 packet), the delay is dominated by per-hop
 * latency. For bulk transfers (many MB), the time is dominated by
 * throughput = bottleneck bandwidth.
 *
 * Model:
 *   totalTime = max(propagationTime, transferTime_throughput)
 *
 * where:
 *   propagationTime = Σ per-hop delays (propagation + ser + queue + retx)
 *   transferTime_throughput = dataSizeMB / effectiveBandwidth
 *   effectiveBandwidth = bottleneck_bw * (1 − max_utilization_on_path)
 *                        with congestion penalty if needed
 *
 * @param graph      The network topology graph.
 * @param fromNode   Source node ID.
 * @param toNode     Destination node ID.
 * @param dataSizeMB Size of data to transfer in megabytes.
 * @param rng        Seeded PRNG for jitter and loss simulation.
 * @returns A {@link TransferResult} with full path and timing details.
 */
export function calculateTransferTime(
  graph: TopologyGraph,
  fromNode: string,
  toNode: string,
  dataSizeMB: number,
  rng: () => number
): TransferResult {
  // Same node → zero transfer time
  if (fromNode === toNode) {
    return {
      transferTimeSec: 0,
      pathLatencyMs: 0,
      bottleneckBandwidthMbps: Infinity,
      path: [fromNode],
      hops: 0,
      congested: false,
    };
  }

  // Find shortest path by latency
  const path = graph.getShortestPath(fromNode, toNode, 'latency');
  if (!path || path.length < 2) {
    return {
      transferTimeSec: Infinity,
      pathLatencyMs: Infinity,
      bottleneckBandwidthMbps: 0,
      path: [],
      hops: 0,
      congested: false,
    };
  }

  const hops = path.length - 1;
  let totalHopDelayMs = 0;
  let bottleneckBw = Infinity;
  let congested = false;
  let maxUtilOnPath = 0;
  let worstCongestionFactor = 1.0;

  // Accumulate per-hop delays
  for (let i = 0; i < hops; i++) {
    const edge = graph.getEdge(path[i], path[i + 1]);
    if (!edge) {
      return {
        transferTimeSec: Infinity,
        pathLatencyMs: Infinity,
        bottleneckBandwidthMbps: 0,
        path,
        hops,
        congested: false,
      };
    }

    const hopDelay = computeHopDelay(
      edge.latencyMs,
      edge.jitterMs,
      edge.bandwidthMbps,
      edge.utilization,
      edge.packetLossRate,
      edge.congestionFactor,
      rng
    );

    totalHopDelayMs += hopDelay;
    bottleneckBw = Math.min(bottleneckBw, edge.bandwidthMbps);

    if (edge.utilization > maxUtilOnPath) {
      maxUtilOnPath = edge.utilization;
    }

    if (edge.utilization > CONGESTION_THRESHOLD) {
      congested = true;
      worstCongestionFactor = Math.max(worstCongestionFactor, edge.congestionFactor);
    }
  }

  // Calculate bulk transfer throughput
  //   effectiveBw = bottleneckBw * (1 − utilization), capped at min 1% of capacity
  let effectiveBw = bottleneckBw * Math.max(0.01, 1 - maxUtilOnPath);

  // Additional congestion penalty on throughput
  if (maxUtilOnPath > CONGESTION_THRESHOLD && worstCongestionFactor > 1) {
    effectiveBw /= worstCongestionFactor;
  }

  // Ensure we don't divide by zero
  effectiveBw = Math.max(effectiveBw, 0.001); // At least 1 Kbps

  // Convert data size to megabits: MB * 8 = Megabits
  const dataSizeMbit = dataSizeMB * 8;

  // Throughput transfer time in seconds: Megabits / Mbps = seconds
  const throughputTimeSec = dataSizeMbit / effectiveBw;

  // Propagation delay in seconds
  const propagationTimeSec = totalHopDelayMs / 1000;

  // Total transfer time: for bulk transfers, throughput dominates;
  // propagation delay is additive (first bit to arrive + drain time)
  const transferTimeSec = propagationTimeSec + throughputTimeSec;

  // Path latency is the sum of base latencies (no jitter, no queueing)
  const pathLatencyMs = graph.getPathLatency(path);

  return {
    transferTimeSec,
    pathLatencyMs,
    bottleneckBandwidthMbps: bottleneckBw,
    path,
    hops,
    congested,
  };
}

// ---------------------------------------------------------------------------
// Round-Trip Time
// ---------------------------------------------------------------------------

/**
 * Calculate the round-trip time (RTT) between two nodes.
 *
 * RTT = forward per-hop delays + reverse per-hop delays.
 *
 * We find the shortest path in each direction (which may differ in a
 * directed graph) and sum all hop delays.
 *
 * @param graph    The network topology graph.
 * @param fromNode Source node ID.
 * @param toNode   Destination node ID.
 * @param rng      Seeded PRNG.
 * @returns RTT in milliseconds, or Infinity if no path exists.
 */
export function calculateRTT(
  graph: TopologyGraph,
  fromNode: string,
  toNode: string,
  rng: () => number
): number {
  if (fromNode === toNode) return 0;

  const forwardPath = graph.getShortestPath(fromNode, toNode, 'latency');
  const reversePath = graph.getShortestPath(toNode, fromNode, 'latency');

  if (!forwardPath || !reversePath) return Infinity;

  let rttMs = 0;

  // Forward path delays
  for (let i = 0; i < forwardPath.length - 1; i++) {
    const edge = graph.getEdge(forwardPath[i], forwardPath[i + 1]);
    if (!edge) return Infinity;
    rttMs += computeHopDelay(
      edge.latencyMs,
      edge.jitterMs,
      edge.bandwidthMbps,
      edge.utilization,
      edge.packetLossRate,
      edge.congestionFactor,
      rng
    );
  }

  // Reverse path delays
  for (let i = 0; i < reversePath.length - 1; i++) {
    const edge = graph.getEdge(reversePath[i], reversePath[i + 1]);
    if (!edge) return Infinity;
    rttMs += computeHopDelay(
      edge.latencyMs,
      edge.jitterMs,
      edge.bandwidthMbps,
      edge.utilization,
      edge.packetLossRate,
      edge.congestionFactor,
      rng
    );
  }

  return rttMs;
}

// ---------------------------------------------------------------------------
// Link utilization management
// ---------------------------------------------------------------------------

/**
 * Update the utilization of all links along the path from one node to
 * another, reflecting the additional bandwidth consumed by an active
 * transfer.
 *
 * Utilization is clamped to [0, 1]. This must be called when a transfer
 * starts (positive bandwidthUsedMbps) and again when it ends (negative
 * value to release capacity).
 *
 * @param graph           The network topology graph.
 * @param fromNode        Source node ID.
 * @param toNode          Destination node ID.
 * @param bandwidthUsedMbps Bandwidth to add (positive) or release (negative).
 */
export function updateLinkUtilization(
  graph: TopologyGraph,
  fromNode: string,
  toNode: string,
  bandwidthUsedMbps: number
): void {
  const path = graph.getShortestPath(fromNode, toNode, 'latency');
  if (!path || path.length < 2) return;

  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.getEdge(path[i], path[i + 1]);
    if (!edge) continue;

    // utilization = bandwidth_used / capacity
    const delta = edge.bandwidthMbps > 0
      ? bandwidthUsedMbps / edge.bandwidthMbps
      : 0;

    const newUtilization = Math.max(0, Math.min(1, edge.utilization + delta));
    graph.updateEdge(path[i], path[i + 1], { utilization: newUtilization });
  }
}

/**
 * Take a snapshot of current network-wide utilization.
 *
 * @param graph The network topology graph.
 * @returns An object with per-link utilization, average, and congestion count.
 */
export function getNetworkSnapshot(
  graph: TopologyGraph
): { linkUtilizations: Map<string, number>; avgUtilization: number; congestionCount: number } {
  const edges = graph.getAllEdges();
  const linkUtilizations = new Map<string, number>();
  let totalUtil = 0;
  let congestionCount = 0;

  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`;
    linkUtilizations.set(key, edge.properties.utilization);
    totalUtil += edge.properties.utilization;
    if (edge.properties.utilization > CONGESTION_THRESHOLD) {
      congestionCount++;
    }
  }

  const avgUtilization = edges.length > 0 ? totalUtil / edges.length : 0;

  return { linkUtilizations, avgUtilization, congestionCount };
}
