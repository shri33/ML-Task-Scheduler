/**
 * Topology Graph
 * ==============
 * A weighted directed graph representing the network topology of a
 * fog computing environment.
 *
 * Design decisions:
 * - Adjacency list via Map<string, Map<string, LinkProperties>> gives O(1)
 *   edge lookups and O(degree) neighbor enumeration — critical for the
 *   inner loops of Dijkstra and transfer simulation.
 * - Dijkstra is parameterized by metric (latency, hops, inverse bandwidth)
 *   so the scheduler and network simulator can each find optimal paths
 *   by their own criterion.
 * - getPathLatency / getPathBandwidth are separated from Dijkstra because
 *   the scheduler often needs to evaluate a *known* path's properties
 *   without re-running shortest-path.
 *
 * Reference: Cormen et al., "Introduction to Algorithms" (4th ed.), Ch. 22-24.
 */

import { LinkProperties } from '../types';

/**
 * Minimum binary heap used as the priority queue for Dijkstra's algorithm.
 *
 * A dedicated min-heap avoids the O(n) extract-min of a naive array scan.
 * Entries are {node, distance} pairs; decrease-key is implemented via
 * lazy insertion (insert a new entry with updated distance, skip stale
 * entries on extraction).
 */
class MinHeap<T> {
  private heap: Array<{ key: number; value: T }> = [];

  /** Number of entries (may include stale duplicates). */
  get size(): number {
    return this.heap.length;
  }

  /** Insert a (key, value) pair. O(log n). */
  push(key: number, value: T): void {
    this.heap.push({ key, value });
    this._bubbleUp(this.heap.length - 1);
  }

  /** Extract the entry with the smallest key. O(log n). */
  pop(): { key: number; value: T } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[idx].key < this.heap[parent].key) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  private _sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.heap[left].key < this.heap[smallest].key) {
        smallest = left;
      }
      if (right < length && this.heap[right].key < this.heap[smallest].key) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Weighted directed graph for fog computing network topologies.
 *
 * Nodes are identified by string IDs. Each directed edge carries a
 * {@link LinkProperties} object describing latency, bandwidth, jitter,
 * packet loss, utilization, and congestion behaviour.
 */
export class TopologyGraph {
  /**
   * Adjacency list: outer key = source node ID, inner key = target node ID,
   * value = link properties for that directed edge.
   */
  private adjacency: Map<string, Map<string, LinkProperties>> = new Map();

  /** Set of all node IDs for O(1) existence checks. */
  private nodes: Set<string> = new Set();

  // -----------------------------------------------------------------------
  // Node operations
  // -----------------------------------------------------------------------

  /**
   * Add a node to the graph. If the node already exists, this is a no-op.
   * @param id Unique node identifier.
   */
  addNode(id: string): void {
    if (this.nodes.has(id)) return;
    this.nodes.add(id);
    this.adjacency.set(id, new Map());
  }

  /**
   * Remove a node and all edges incident to it (both outgoing and incoming).
   * @param id Node to remove.
   */
  removeNode(id: string): void {
    if (!this.nodes.has(id)) return;
    // Remove outgoing edges
    this.adjacency.delete(id);
    // Remove incoming edges from all other nodes
    for (const [, neighbors] of this.adjacency) {
      neighbors.delete(id);
    }
    this.nodes.delete(id);
  }

  /**
   * Check whether a node exists in the graph.
   * @param id Node to check.
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Return the total number of nodes.
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  // -----------------------------------------------------------------------
  // Edge operations
  // -----------------------------------------------------------------------

  /**
   * Add a directed edge from `source` to `target`. Both nodes are auto-created
   * if they do not exist yet (convenient for bulk topology construction).
   *
   * If the edge already exists, its properties are overwritten.
   *
   * @param source Source node ID.
   * @param target Target node ID.
   * @param props  Link properties for this edge.
   */
  addEdge(source: string, target: string, props: LinkProperties): void {
    this.addNode(source);
    this.addNode(target);
    this.adjacency.get(source)!.set(target, props);
  }

  /**
   * Remove a directed edge. No-op if it doesn't exist.
   * @param source Source node ID.
   * @param target Target node ID.
   */
  removeEdge(source: string, target: string): void {
    this.adjacency.get(source)?.delete(target);
  }

  /**
   * Check whether a directed edge exists.
   */
  hasEdge(source: string, target: string): boolean {
    return this.adjacency.get(source)?.has(target) ?? false;
  }

  /**
   * Get the properties of a directed edge, or `undefined` if it doesn't exist.
   */
  getEdge(source: string, target: string): LinkProperties | undefined {
    return this.adjacency.get(source)?.get(target);
  }

  /**
   * Update properties of an existing edge in-place. Throws if the edge
   * does not exist.
   */
  updateEdge(source: string, target: string, update: Partial<LinkProperties>): void {
    const edge = this.adjacency.get(source)?.get(target);
    if (!edge) {
      throw new Error(`Edge ${source} -> ${target} does not exist`);
    }
    Object.assign(edge, update);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Return all neighbor node IDs reachable by outgoing edges from `id`.
   */
  getNeighbors(id: string): string[] {
    const neighbors = this.adjacency.get(id);
    if (!neighbors) return [];
    return Array.from(neighbors.keys());
  }

  /**
   * Return all outgoing edges from `id` as [targetId, LinkProperties] pairs.
   */
  getOutgoingEdges(id: string): Array<[string, LinkProperties]> {
    const neighbors = this.adjacency.get(id);
    if (!neighbors) return [];
    return Array.from(neighbors.entries());
  }

  /**
   * Return all node IDs in the graph.
   */
  getAllNodes(): string[] {
    return Array.from(this.nodes);
  }

  /**
   * Return all directed edges as {source, target, properties} triples.
   */
  getAllEdges(): Array<{ source: string; target: string; properties: LinkProperties }> {
    const edges: Array<{ source: string; target: string; properties: LinkProperties }> = [];
    for (const [source, neighbors] of this.adjacency) {
      for (const [target, properties] of neighbors) {
        edges.push({ source, target, properties });
      }
    }
    return edges;
  }

  /**
   * Compute the in-degree of a node (number of incoming edges).
   * O(V) — iterates all adjacency lists.
   */
  getInDegree(id: string): number {
    let count = 0;
    for (const [, neighbors] of this.adjacency) {
      if (neighbors.has(id)) count++;
    }
    return count;
  }

  /**
   * Compute the out-degree of a node (number of outgoing edges).
   */
  getOutDegree(id: string): number {
    return this.adjacency.get(id)?.size ?? 0;
  }

  /**
   * Compute the total degree (in + out) of a node.
   * For undirected graphs (where every edge A→B has a matching B→A),
   * this counts each undirected edge twice.
   */
  getDegree(id: string): number {
    return this.getInDegree(id) + this.getOutDegree(id);
  }

  // -----------------------------------------------------------------------
  // Dijkstra's Shortest Path
  // -----------------------------------------------------------------------

  /**
   * Textbook Dijkstra with a binary min-heap priority queue.
   *
   * The `metric` parameter selects the edge weight function:
   * - `'latency'`: weight = latencyMs  → shortest-delay path
   * - `'hops'`:    weight = 1          → fewest-hops path
   * - `'bandwidth'`: weight = 1 / bandwidthMbps → highest-bandwidth path
   *
   * The bandwidth metric uses reciprocal weights so that Dijkstra
   * (which minimizes total weight) effectively maximizes the minimum
   * bandwidth when the bottleneck is the sum of reciprocals is minimized.
   * However, note: for true max-bottleneck-bandwidth, a modified Dijkstra
   * is needed; this approach finds the path that maximizes the harmonic
   * mean bandwidth, which is a reasonable proxy in practice.
   *
   * @param source Starting node ID.
   * @param target Destination node ID.
   * @param metric Weight function to use.
   * @returns Ordered array of node IDs from source to target, or `null`
   *          if no path exists.
   *
   * @see Cormen et al., "Introduction to Algorithms", Section 24.3
   */
  getShortestPath(
    source: string,
    target: string,
    metric: 'latency' | 'hops' | 'bandwidth'
  ): string[] | null {
    if (!this.nodes.has(source) || !this.nodes.has(target)) return null;
    if (source === target) return [source];

    const dist: Map<string, number> = new Map();
    const prev: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();

    // Initialize distances to Infinity
    for (const node of this.nodes) {
      dist.set(node, Infinity);
      prev.set(node, null);
    }
    dist.set(source, 0);

    const pq = new MinHeap<string>();
    pq.push(0, source);

    while (pq.size > 0) {
      const entry = pq.pop()!;
      const u = entry.value;
      const uDist = entry.key;

      // Skip stale entries (from lazy decrease-key)
      if (visited.has(u)) continue;
      visited.add(u);

      // Early exit if we've reached the target
      if (u === target) break;

      // Skip if the recorded distance is already better (stale entry)
      if (uDist > dist.get(u)!) continue;

      const neighbors = this.adjacency.get(u);
      if (!neighbors) continue;

      for (const [v, props] of neighbors) {
        if (visited.has(v)) continue;

        const weight = this._edgeWeight(props, metric);
        const newDist = uDist + weight;

        if (newDist < dist.get(v)!) {
          dist.set(v, newDist);
          prev.set(v, u);
          pq.push(newDist, v);
        }
      }
    }

    // Reconstruct path
    if (!visited.has(target)) return null;

    const path: string[] = [];
    let current: string | null = target;
    while (current !== null) {
      path.push(current);
      current = prev.get(current) ?? null;
    }
    path.reverse();

    return path;
  }

  /**
   * Compute edge weight based on the selected metric.
   *
   * @internal
   */
  private _edgeWeight(props: LinkProperties, metric: 'latency' | 'hops' | 'bandwidth'): number {
    switch (metric) {
      case 'latency':
        return props.latencyMs;
      case 'hops':
        return 1;
      case 'bandwidth':
        // Reciprocal: minimizing sum of 1/bw approximates maximizing
        // path bandwidth (harmonic mean proxy).
        return props.bandwidthMbps > 0 ? 1 / props.bandwidthMbps : Infinity;
      default:
        return props.latencyMs;
    }
  }

  // -----------------------------------------------------------------------
  // Path metrics
  // -----------------------------------------------------------------------

  /**
   * Sum of one-way propagation latencies (latencyMs) along a path.
   *
   * This is the *base* latency without jitter, queueing, or serialization —
   * useful for quick cost estimates in scheduling heuristics.
   *
   * @param path Ordered node IDs (e.g. from getShortestPath).
   * @returns Total latency in milliseconds, or Infinity if any edge is missing.
   */
  getPathLatency(path: string[]): number {
    if (path.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.getEdge(path[i], path[i + 1]);
      if (!edge) return Infinity;
      total += edge.latencyMs;
    }
    return total;
  }

  /**
   * Minimum bandwidth along a path (bottleneck bandwidth).
   *
   * In store-and-forward networks, a bulk transfer's throughput is limited
   * by the narrowest link. This is the standard bottleneck model used in
   * networking research.
   *
   * @param path Ordered node IDs.
   * @returns Bottleneck bandwidth in Mbps, or 0 if any edge is missing.
   */
  getPathBandwidth(path: string[]): number {
    if (path.length < 2) return Infinity;
    let minBw = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.getEdge(path[i], path[i + 1]);
      if (!edge) return 0;
      minBw = Math.min(minBw, edge.bandwidthMbps);
    }
    return minBw;
  }

  /**
   * Get the effective bandwidth of a path, accounting for current utilization.
   *
   * effectiveBw = bandwidth * (1 - utilization)
   * Bottleneck is the minimum effective bandwidth along the path.
   *
   * @param path Ordered node IDs.
   * @returns Effective bottleneck bandwidth in Mbps.
   */
  getEffectivePathBandwidth(path: string[]): number {
    if (path.length < 2) return Infinity;
    let minEffBw = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.getEdge(path[i], path[i + 1]);
      if (!edge) return 0;
      const effective = edge.bandwidthMbps * (1 - edge.utilization);
      minEffBw = Math.min(minEffBw, effective);
    }
    return minEffBw;
  }

  /**
   * Check whether any link along a path is congested (utilization > 0.8).
   */
  isPathCongested(path: string[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.getEdge(path[i], path[i + 1]);
      if (edge && edge.utilization > 0.8) return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /**
   * Export the graph to a plain JSON-serializable object.
   */
  toJSON(): { nodes: string[]; edges: Array<{ source: string; target: string; properties: LinkProperties }> } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  /**
   * Import a graph from a JSON object (as produced by toJSON or the custom loader).
   * Clears any existing graph state first.
   */
  static fromJSON(data: {
    nodes: Array<string | { id: string }>;
    edges: Array<{ source: string; target: string; properties: LinkProperties }>;
  }): TopologyGraph {
    const graph = new TopologyGraph();
    for (const node of data.nodes) {
      const id = typeof node === 'string' ? node : node.id;
      graph.addNode(id);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge.source, edge.target, { ...edge.properties });
    }
    return graph;
  }
}
