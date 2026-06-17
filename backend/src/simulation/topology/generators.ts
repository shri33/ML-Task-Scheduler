/**
 * Topology Generators
 * ===================
 * Create TopologyGraph instances using well-known random graph models
 * from the networking research literature.
 *
 * Every generator uses a seeded PRNG (Mulberry32) so that experiments
 * are fully reproducible given the same seed.
 *
 * Implemented models:
 *
 * 1. **Waxman** — random geometric graph where edge probability decays
 *    exponentially with Euclidean distance. Widely used in WAN/ISP
 *    topology generation.
 *    Reference: B. Waxman, "Routing of multipoint connections," IEEE JSAC, 1988.
 *
 * 2. **Barabási–Albert** — preferential attachment produces scale-free
 *    degree distributions observed in many real networks (power grids,
 *    the Internet AS graph, social networks).
 *    Reference: Barabási & Albert, "Emergence of scaling in random networks,"
 *    Science, 1999.
 *
 * 3. **Hierarchical** — deterministic tree topology that mirrors a
 *    real cloud → fog → edge → device deployment. Most directly useful
 *    for the fog computing scheduler benchmark.
 *
 * 4. **Custom JSON Loader** — import a user-defined topology from disk.
 */

import { LinkProperties, NodeTier } from '../types';
import { TopologyGraph } from './graph';

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32
// ---------------------------------------------------------------------------

/**
 * Mulberry32: a fast 32-bit seeded PRNG with a period of 2^32.
 *
 * Returns a function that yields uniform floats in [0, 1).
 * Deterministic for a given seed — essential for reproducible experiments.
 *
 * @param seed 32-bit integer seed.
 * @returns A function that returns the next pseudo-random float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: generate a Gaussian-distributed random number
 * from two uniform random numbers.
 *
 * @param rng Seeded PRNG function returning uniform [0, 1).
 * @param mean Mean of the distribution.
 * @param stddev Standard deviation.
 * @returns A single sample from N(mean, stddev²).
 */
export function gaussianRandom(rng: () => number, mean: number, stddev: number): number {
  // Marsaglia polar form avoids trig calls and is numerically more stable.
  let u: number, v: number, s: number;
  do {
    u = 2 * rng() - 1;
    v = 2 * rng() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  const mul = Math.sqrt((-2 * Math.log(s)) / s);
  return mean + stddev * u * mul;
}

// ---------------------------------------------------------------------------
// Link property helpers
// ---------------------------------------------------------------------------

/**
 * Assign realistic link properties based on Euclidean distance between nodes
 * and a tier-based model. Longer links get higher latency, lower bandwidth.
 *
 * Latency model: baseLatency + distanceFactor * distance
 *   - Light in fibre ≈ 2/3 c ≈ 200 km/ms, so 1 km ≈ 0.005 ms propagation.
 *   - We scale to the [0, maxCoord] domain and add equipment/processing delay.
 *
 * Bandwidth model: inversely correlated with distance via a log transform.
 *
 * @param distance Euclidean distance between nodes.
 * @param maxDistance Maximum possible distance in the topology.
 * @param rng Seeded PRNG.
 */
function distanceBasedLinkProperties(
  distance: number,
  maxDistance: number,
  rng: () => number
): LinkProperties {
  // Normalize distance to [0, 1]
  const normDist = maxDistance > 0 ? distance / maxDistance : 0;

  // Latency: 1–100 ms scaled by distance + small random jitter component
  const baseLatency = 1 + normDist * 99;
  const latencyMs = Math.max(0.1, baseLatency * (0.8 + 0.4 * rng()));

  // Jitter: 5-20% of latency
  const jitterMs = latencyMs * (0.05 + 0.15 * rng());

  // Bandwidth: shorter links get higher bandwidth (10–10000 Mbps)
  // Inverse relationship: bw = maxBw * exp(-k * normDist)
  const maxBw = 10000;
  const bw = maxBw * Math.exp(-3 * normDist);
  const bandwidthMbps = Math.max(1, bw * (0.7 + 0.6 * rng()));

  // Packet loss: correlated with distance
  const packetLossRate = Math.min(0.1, 0.001 + normDist * 0.01 * rng());

  return {
    latencyMs,
    jitterMs,
    bandwidthMbps,
    utilization: 0,
    packetLossRate,
    congestionFactor: 1.5 + rng() * 1.5, // 1.5–3.0
  };
}

/**
 * Create link properties for a specific tier-to-tier connection in the
 * hierarchical topology.
 */
function tierLinkProperties(
  parentTier: NodeTier,
  childTier: NodeTier,
  rng: () => number
): LinkProperties {
  // Predefined realistic ranges per tier pair
  switch (`${parentTier}-${childTier}`) {
    case `${NodeTier.CLOUD}-${NodeTier.CLOUD}`:
      return {
        latencyMs: 2 + rng() * 5,        // 2-7 ms (DC interconnect)
        jitterMs: 0.1 + rng() * 0.5,
        bandwidthMbps: 40000 + rng() * 60000,  // 40-100 Gbps
        utilization: 0,
        packetLossRate: 0.00001 + rng() * 0.00005,
        congestionFactor: 1.2 + rng() * 0.3,
      };
    case `${NodeTier.CLOUD}-${NodeTier.FOG}`:
      return {
        latencyMs: 10 + rng() * 30,      // 10-40 ms (WAN)
        jitterMs: 1 + rng() * 5,
        bandwidthMbps: 1000 + rng() * 9000,   // 1-10 Gbps
        utilization: 0,
        packetLossRate: 0.0001 + rng() * 0.001,
        congestionFactor: 1.5 + rng() * 1.0,
      };
    case `${NodeTier.FOG}-${NodeTier.FOG}`:
      return {
        latencyMs: 5 + rng() * 15,       // 5-20 ms (regional)
        jitterMs: 0.5 + rng() * 3,
        bandwidthMbps: 500 + rng() * 4500,    // 500 Mbps - 5 Gbps
        utilization: 0,
        packetLossRate: 0.0001 + rng() * 0.002,
        congestionFactor: 1.5 + rng() * 1.0,
      };
    case `${NodeTier.FOG}-${NodeTier.EDGE}`:
      return {
        latencyMs: 5 + rng() * 20,       // 5-25 ms
        jitterMs: 1 + rng() * 5,
        bandwidthMbps: 100 + rng() * 900,     // 100 Mbps - 1 Gbps
        utilization: 0,
        packetLossRate: 0.001 + rng() * 0.005,
        congestionFactor: 2.0 + rng() * 1.5,
      };
    case `${NodeTier.EDGE}-${NodeTier.DEVICE}`:
      return {
        latencyMs: 1 + rng() * 10,       // 1-11 ms (LAN/WiFi)
        jitterMs: 0.5 + rng() * 5,
        bandwidthMbps: 10 + rng() * 90,       // 10-100 Mbps (WiFi/BLE)
        utilization: 0,
        packetLossRate: 0.005 + rng() * 0.02,
        congestionFactor: 2.5 + rng() * 2.0,
      };
    default:
      // Fallback for unexpected tier combinations
      return {
        latencyMs: 20 + rng() * 80,
        jitterMs: 2 + rng() * 10,
        bandwidthMbps: 50 + rng() * 950,
        utilization: 0,
        packetLossRate: 0.001 + rng() * 0.01,
        congestionFactor: 2.0 + rng() * 1.5,
      };
  }
}

// ---------------------------------------------------------------------------
// Generator: Waxman
// ---------------------------------------------------------------------------

/** Configuration for the Waxman random graph generator. */
export interface WaxmanConfig {
  /** Number of nodes to generate. */
  numNodes: number;
  /**
   * α ∈ (0, 1] — distance scaling factor.
   * Higher α means long-distance edges are more likely.
   */
  alpha: number;
  /**
   * β ∈ (0, 1] — overall edge density.
   * Higher β means more edges overall.
   */
  beta: number;
  /** PRNG seed for reproducibility. */
  seed: number;
  /** Optional: coordinate space width/height (default 1000). */
  maxCoord?: number;
}

/**
 * Generate a Waxman random graph.
 *
 * The Waxman model places nodes uniformly at random in a 2-D plane and
 * creates an edge between nodes u and v with probability:
 *
 *   P(u, v) = β · exp( −d(u, v) / (α · L) )
 *
 * where d(u,v) is the Euclidean distance between u and v, and L is the
 * maximum possible distance between any two nodes.
 *
 * This produces graphs whose connectivity decreases with distance,
 * modeling geographic networks like WANs and ISP topologies.
 *
 * @param config Generator parameters.
 * @returns A new TopologyGraph with Waxman-generated edges.
 */
export function generateWaxman(config: WaxmanConfig): TopologyGraph {
  const { numNodes, alpha, beta, seed } = config;
  const maxCoord = config.maxCoord ?? 1000;
  const rng = mulberry32(seed);
  const graph = new TopologyGraph();

  // Validate parameters
  if (alpha <= 0 || alpha > 1) {
    throw new Error(`Waxman alpha must be in (0, 1], got ${alpha}`);
  }
  if (beta <= 0 || beta > 1) {
    throw new Error(`Waxman beta must be in (0, 1], got ${beta}`);
  }
  if (numNodes < 1) {
    throw new Error(`numNodes must be >= 1, got ${numNodes}`);
  }

  // Step 1: Place nodes at random (x, y) positions
  const positions: Array<{ id: string; x: number; y: number }> = [];
  for (let i = 0; i < numNodes; i++) {
    const id = `wax-${i}`;
    const x = rng() * maxCoord;
    const y = rng() * maxCoord;
    positions.push({ id, x, y });
    graph.addNode(id);
  }

  // Maximum possible distance in the square domain
  const L = Math.sqrt(2) * maxCoord;

  // Step 2: For each pair, create edge with Waxman probability
  for (let i = 0; i < numNodes; i++) {
    for (let j = 0; j < numNodes; j++) {
      if (i === j) continue;

      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Waxman probability: P = β * exp(-d / (α * L))
      const probability = beta * Math.exp(-dist / (alpha * L));

      if (rng() < probability) {
        const props = distanceBasedLinkProperties(dist, L, rng);
        graph.addEdge(positions[i].id, positions[j].id, props);
      }
    }
  }

  // Ensure graph connectivity: connect isolated nodes to nearest neighbor
  ensureConnectivity(graph, positions, rng, L);

  return graph;
}

/**
 * Ensure the graph is weakly connected by linking isolated components
 * to the nearest node in the largest component.
 */
function ensureConnectivity(
  graph: TopologyGraph,
  positions: Array<{ id: string; x: number; y: number }>,
  rng: () => number,
  maxDistance: number
): void {
  const posMap = new Map<string, { x: number; y: number }>();
  for (const p of positions) {
    posMap.set(p.id, { x: p.x, y: p.y });
  }

  // Find connected components via BFS
  const allNodes = graph.getAllNodes();
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of allNodes) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const queue: string[] = [start];
    visited.add(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      component.push(node);
      // Check outgoing
      for (const neighbor of graph.getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
      // Check incoming (for weak connectivity)
      for (const other of allNodes) {
        if (!visited.has(other) && graph.hasEdge(other, node)) {
          visited.add(other);
          queue.push(other);
        }
      }
    }
    components.push(component);
  }

  if (components.length <= 1) return;

  // Sort components by size (largest first)
  components.sort((a, b) => b.length - a.length);
  const mainComponent = new Set(components[0]);

  // Connect each smaller component to the main component
  for (let c = 1; c < components.length; c++) {
    const comp = components[c];
    let bestDist = Infinity;
    let bestFrom = comp[0];
    let bestTo = components[0][0];

    for (const nodeA of comp) {
      const posA = posMap.get(nodeA);
      if (!posA) continue;
      for (const nodeB of mainComponent) {
        const posB = posMap.get(nodeB);
        if (!posB) continue;
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestFrom = nodeA;
          bestTo = nodeB;
        }
      }
    }

    // Add bidirectional edge
    const props = distanceBasedLinkProperties(bestDist, maxDistance, rng);
    graph.addEdge(bestFrom, bestTo, props);
    graph.addEdge(bestTo, bestFrom, { ...props });

    // Merge into main component
    for (const n of comp) {
      mainComponent.add(n);
    }
  }
}

// ---------------------------------------------------------------------------
// Generator: Barabási–Albert (Preferential Attachment)
// ---------------------------------------------------------------------------

/** Configuration for the Barabási–Albert generator. */
export interface BarabasiAlbertConfig {
  /** Total number of nodes in the final graph. */
  numNodes: number;
  /**
   * Number of edges each new node creates (m).
   * Must satisfy m <= m₀ (initial seed clique size, which is m + 1).
   */
  m: number;
  /** PRNG seed. */
  seed: number;
  /** Optional: coordinate space for distance-based link properties (default 1000). */
  maxCoord?: number;
}

/**
 * Generate a Barabási–Albert preferential attachment graph.
 *
 * Algorithm:
 * 1. Start with a fully connected seed graph of m₀ = m + 1 nodes.
 * 2. For each new node, connect it to m existing nodes chosen with
 *    probability proportional to their current degree:
 *      P(connecting to node i) = degree(i) / Σ degree(j)
 *
 * This produces a scale-free network with a power-law degree distribution
 * P(k) ~ k^(-3), as shown by Barabási & Albert (1999).
 *
 * @param config Generator parameters.
 * @returns A new TopologyGraph with BA-model edges.
 */
export function generateBarabasiAlbert(config: BarabasiAlbertConfig): TopologyGraph {
  const { numNodes, m, seed } = config;
  const maxCoord = config.maxCoord ?? 1000;
  const rng = mulberry32(seed);
  const graph = new TopologyGraph();

  if (m < 1) {
    throw new Error(`Barabási–Albert m must be >= 1, got ${m}`);
  }
  if (numNodes < m + 1) {
    throw new Error(`numNodes must be >= m + 1 = ${m + 1}, got ${numNodes}`);
  }

  // Random positions for distance-based link properties
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds: string[] = [];

  // Degree tracking for preferential attachment
  // In an undirected graph modelled with bidirectional edges,
  // we track "undirected degree" explicitly.
  const degree = new Map<string, number>();

  // Step 1: Seed graph — fully connected clique of m₀ = m + 1 nodes
  const m0 = m + 1;
  for (let i = 0; i < m0; i++) {
    const id = `ba-${i}`;
    nodeIds.push(id);
    positions.set(id, { x: rng() * maxCoord, y: rng() * maxCoord });
    graph.addNode(id);
    degree.set(id, 0);
  }

  // Connect all seed nodes to each other (complete graph)
  for (let i = 0; i < m0; i++) {
    for (let j = 0; j < m0; j++) {
      if (i === j) continue;
      const posI = positions.get(nodeIds[i])!;
      const posJ = positions.get(nodeIds[j])!;
      const dist = Math.sqrt(
        (posI.x - posJ.x) ** 2 + (posI.y - posJ.y) ** 2
      );
      const maxDist = Math.sqrt(2) * maxCoord;
      const props = distanceBasedLinkProperties(dist, maxDist, rng);
      graph.addEdge(nodeIds[i], nodeIds[j], props);
    }
    // Each seed node is connected to m0-1 others
    degree.set(nodeIds[i], m0 - 1);
  }

  // Step 2: Preferential attachment — add remaining nodes one at a time
  for (let i = m0; i < numNodes; i++) {
    const newId = `ba-${i}`;
    nodeIds.push(newId);
    positions.set(newId, { x: rng() * maxCoord, y: rng() * maxCoord });
    graph.addNode(newId);
    degree.set(newId, 0);

    // Select m distinct existing nodes with probability ∝ degree
    const targets = preferentialSelect(nodeIds.slice(0, i), degree, m, rng);

    const posNew = positions.get(newId)!;
    const maxDist = Math.sqrt(2) * maxCoord;

    for (const targetId of targets) {
      const posTarget = positions.get(targetId)!;
      const dist = Math.sqrt(
        (posNew.x - posTarget.x) ** 2 + (posNew.y - posTarget.y) ** 2
      );
      const props = distanceBasedLinkProperties(dist, maxDist, rng);

      // Bidirectional edges (undirected graph)
      graph.addEdge(newId, targetId, props);
      graph.addEdge(targetId, newId, { ...props });

      degree.set(newId, degree.get(newId)! + 1);
      degree.set(targetId, degree.get(targetId)! + 1);
    }
  }

  return graph;
}

/**
 * Select `count` distinct nodes from `candidates` with probability
 * proportional to their degree (preferential attachment).
 *
 * Uses the roulette-wheel (fitness-proportionate) selection method:
 * P(i) = degree(i) / Σ_j degree(j)
 *
 * @param candidates Array of candidate node IDs.
 * @param degree Map from node ID to its current degree.
 * @param count Number of distinct nodes to select.
 * @param rng Seeded PRNG.
 * @returns Array of selected node IDs (length = count).
 */
function preferentialSelect(
  candidates: string[],
  degree: Map<string, number>,
  count: number,
  rng: () => number
): string[] {
  const selected = new Set<string>();
  const result: string[] = [];

  // Total degree for normalization
  let totalDegree = 0;
  for (const id of candidates) {
    totalDegree += degree.get(id) ?? 0;
  }

  // Guard: if all degrees are 0 (degenerate), fall back to uniform random
  if (totalDegree === 0) {
    while (result.length < count && result.length < candidates.length) {
      const idx = Math.floor(rng() * candidates.length);
      const id = candidates[idx];
      if (!selected.has(id)) {
        selected.add(id);
        result.push(id);
      }
    }
    return result;
  }

  // Roulette-wheel selection
  while (result.length < count && result.length < candidates.length) {
    let r = rng() * totalDegree;
    for (const id of candidates) {
      if (selected.has(id)) continue;
      r -= degree.get(id) ?? 0;
      if (r <= 0) {
        selected.add(id);
        result.push(id);
        // Adjust totalDegree for remaining selections
        totalDegree -= degree.get(id) ?? 0;
        break;
      }
    }
    // Safety: if floating-point rounding caused us to not select anyone
    if (result.length < count && r > 0) {
      for (const id of candidates) {
        if (!selected.has(id)) {
          selected.add(id);
          result.push(id);
          totalDegree -= degree.get(id) ?? 0;
          break;
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Generator: Hierarchical (Cloud → Fog → Edge → Device)
// ---------------------------------------------------------------------------

/** Configuration for the hierarchical topology generator. */
export interface HierarchicalConfig {
  /** Number of cloud data center nodes. */
  numCloud: number;
  /** Number of fog nodes per cloud node. */
  numFogPerCloud: number;
  /** Number of edge nodes per fog node. */
  numEdgePerFog: number;
  /** Number of device nodes per edge node. */
  numDevicesPerEdge: number;
  /** PRNG seed. */
  seed: number;
  /**
   * Probability of creating a cross-link between fog nodes in the
   * same region (default 0.3).
   */
  fogCrossLinkProbability?: number;
}

/**
 * Node metadata emitted by the hierarchical generator so that the caller
 * can create SimNode objects with correct tier labels.
 */
export interface HierarchicalNodeInfo {
  id: string;
  tier: NodeTier;
  parentId: string | null;
  regionId: string;
}

/**
 * Result of the hierarchical generator: the graph plus node metadata.
 */
export interface HierarchicalResult {
  graph: TopologyGraph;
  nodeInfos: HierarchicalNodeInfo[];
}

/**
 * Generate a hierarchical tree topology mimicking a real cloud-fog-edge
 * deployment.
 *
 * Structure:
 *   Cloud₁ ←→ Cloud₂ ←→ Cloud₃ (fully connected backbone)
 *     ├── Fog₁ₐ  ├── Fog₂ₐ
 *     ├── Fog₁ᵦ  └── Fog₂ᵦ
 *     │    ├── Edge₁ₐ₁
 *     │    │    ├── Dev₁
 *     │    │    └── Dev₂
 *     │    └── Edge₁ₐ₂
 *     ...
 *
 * Each tier level has characteristic latency, bandwidth, and loss rates.
 * Cross-links are added between fog nodes under the same cloud to model
 * regional mesh connectivity.
 *
 * @param config Generator parameters.
 * @returns The graph and per-node metadata (tier, parent, region).
 */
export function generateHierarchical(config: HierarchicalConfig): HierarchicalResult {
  const {
    numCloud,
    numFogPerCloud,
    numEdgePerFog,
    numDevicesPerEdge,
    seed,
  } = config;
  const fogCrossLinkProb = config.fogCrossLinkProbability ?? 0.3;
  const rng = mulberry32(seed);
  const graph = new TopologyGraph();
  const nodeInfos: HierarchicalNodeInfo[] = [];

  if (numCloud < 1) {
    throw new Error(`numCloud must be >= 1, got ${numCloud}`);
  }

  // --- Cloud nodes ---
  const cloudIds: string[] = [];
  for (let c = 0; c < numCloud; c++) {
    const id = `cloud-${c}`;
    cloudIds.push(id);
    graph.addNode(id);
    nodeInfos.push({
      id,
      tier: NodeTier.CLOUD,
      parentId: null,
      regionId: `region-${c}`,
    });
  }

  // Cloud-to-cloud: fully connected backbone
  for (let i = 0; i < cloudIds.length; i++) {
    for (let j = i + 1; j < cloudIds.length; j++) {
      const props = tierLinkProperties(NodeTier.CLOUD, NodeTier.CLOUD, rng);
      graph.addEdge(cloudIds[i], cloudIds[j], props);
      graph.addEdge(cloudIds[j], cloudIds[i], { ...props });
    }
  }

  // --- Fog nodes ---
  const fogIdsByCloud = new Map<string, string[]>();
  let fogCounter = 0;
  for (const cloudId of cloudIds) {
    const fogIds: string[] = [];
    const regionId = nodeInfos.find((n) => n.id === cloudId)!.regionId;

    for (let f = 0; f < numFogPerCloud; f++) {
      const id = `fog-${fogCounter++}`;
      fogIds.push(id);
      graph.addNode(id);
      nodeInfos.push({
        id,
        tier: NodeTier.FOG,
        parentId: cloudId,
        regionId,
      });

      // Cloud ↔ Fog bidirectional link
      const props = tierLinkProperties(NodeTier.CLOUD, NodeTier.FOG, rng);
      graph.addEdge(cloudId, id, props);
      graph.addEdge(id, cloudId, { ...props });
    }

    fogIdsByCloud.set(cloudId, fogIds);

    // Cross-links between fog nodes in the same region
    for (let i = 0; i < fogIds.length; i++) {
      for (let j = i + 1; j < fogIds.length; j++) {
        if (rng() < fogCrossLinkProb) {
          const props = tierLinkProperties(NodeTier.FOG, NodeTier.FOG, rng);
          graph.addEdge(fogIds[i], fogIds[j], props);
          graph.addEdge(fogIds[j], fogIds[i], { ...props });
        }
      }
    }
  }

  // --- Edge nodes ---
  let edgeCounter = 0;
  const allFogIds = Array.from(fogIdsByCloud.values()).flat();
  for (const fogId of allFogIds) {
    const regionId = nodeInfos.find((n) => n.id === fogId)!.regionId;

    for (let e = 0; e < numEdgePerFog; e++) {
      const id = `edge-${edgeCounter++}`;
      graph.addNode(id);
      nodeInfos.push({
        id,
        tier: NodeTier.EDGE,
        parentId: fogId,
        regionId,
      });

      // Fog ↔ Edge bidirectional link
      const props = tierLinkProperties(NodeTier.FOG, NodeTier.EDGE, rng);
      graph.addEdge(fogId, id, props);
      graph.addEdge(id, fogId, { ...props });

      // --- Device nodes ---
      for (let d = 0; d < numDevicesPerEdge; d++) {
        const devId = `device-${id}-${d}`;
        graph.addNode(devId);
        nodeInfos.push({
          id: devId,
          tier: NodeTier.DEVICE,
          parentId: id,
          regionId,
        });

        // Edge ↔ Device bidirectional link
        const devProps = tierLinkProperties(NodeTier.EDGE, NodeTier.DEVICE, rng);
        graph.addEdge(id, devId, devProps);
        graph.addEdge(devId, id, { ...devProps });
      }
    }
  }

  return { graph, nodeInfos };
}

// ---------------------------------------------------------------------------
// Custom JSON Loader
// ---------------------------------------------------------------------------

/**
 * Expected JSON format for custom topology files.
 *
 * ```json
 * {
 *   "nodes": [{ "id": "n1" }, { "id": "n2" }],
 *   "edges": [
 *     {
 *       "source": "n1",
 *       "target": "n2",
 *       "properties": {
 *         "latencyMs": 10,
 *         "jitterMs": 1,
 *         "bandwidthMbps": 1000,
 *         "utilization": 0,
 *         "packetLossRate": 0.001,
 *         "congestionFactor": 2
 *       }
 *     }
 *   ]
 * }
 * ```
 */
export interface TopologyJSON {
  nodes: Array<{ id: string; [key: string]: unknown }>;
  edges: Array<{
    source: string;
    target: string;
    properties: LinkProperties;
  }>;
}

/**
 * Load a topology from a JSON object.
 *
 * Validates that all edge endpoints reference existing nodes and that
 * required link properties are present.
 *
 * @param json Parsed JSON conforming to {@link TopologyJSON}.
 * @returns A new TopologyGraph.
 * @throws Error if validation fails.
 */
export function loadTopologyFromJSON(json: TopologyJSON): TopologyGraph {
  if (!json.nodes || !Array.isArray(json.nodes)) {
    throw new Error('Topology JSON must have a "nodes" array');
  }
  if (!json.edges || !Array.isArray(json.edges)) {
    throw new Error('Topology JSON must have an "edges" array');
  }

  const graph = new TopologyGraph();
  const nodeIds = new Set<string>();

  // Add nodes
  for (const node of json.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new Error(`Invalid node: missing or non-string "id" field`);
    }
    if (nodeIds.has(node.id)) {
      throw new Error(`Duplicate node ID: "${node.id}"`);
    }
    nodeIds.add(node.id);
    graph.addNode(node.id);
  }

  // Add edges
  for (const edge of json.edges) {
    if (!edge.source || !edge.target) {
      throw new Error('Edge missing "source" or "target"');
    }
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge source "${edge.source}" not found in nodes`);
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge target "${edge.target}" not found in nodes`);
    }
    if (!edge.properties) {
      throw new Error(
        `Edge ${edge.source} -> ${edge.target} missing "properties"`
      );
    }

    // Validate required properties with defaults for optional ones
    const props: LinkProperties = {
      latencyMs: edge.properties.latencyMs,
      jitterMs: edge.properties.jitterMs ?? 0,
      bandwidthMbps: edge.properties.bandwidthMbps,
      utilization: edge.properties.utilization ?? 0,
      packetLossRate: edge.properties.packetLossRate ?? 0,
      congestionFactor: edge.properties.congestionFactor ?? 2.0,
    };

    if (typeof props.latencyMs !== 'number' || props.latencyMs < 0) {
      throw new Error(
        `Invalid latencyMs for edge ${edge.source} -> ${edge.target}`
      );
    }
    if (typeof props.bandwidthMbps !== 'number' || props.bandwidthMbps <= 0) {
      throw new Error(
        `Invalid bandwidthMbps for edge ${edge.source} -> ${edge.target}`
      );
    }

    graph.addEdge(edge.source, edge.target, props);
  }

  return graph;
}
