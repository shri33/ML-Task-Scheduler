/**
 * Experiment Runner
 * =================
 * Orchestrates multi-run experiments across multiple algorithms.
 * Ties together: topology → nodes → workload → failures → scheduler → metrics.
 *
 * Usage:
 *   const runner = new ExperimentRunner(config);
 *   const results = runner.runAll();
 *   console.log(generateSummary(results));
 */

import {
  ExperimentConfig,
  ExperimentResult,
  SimNode,
  NodeTier,
  QueueModel,
} from './types';
import { mulberry32, generateSeeds } from './config';
import {
  SimulationEngine,
  SimulationHooks,
  createSimNode,
} from './engine';
import { createScheduler, SchedulerName } from './schedulers/algorithms';
import { loadWorkload } from './workloads/trace-loader';
import {
  aggregateResults,
  exportResultsCSV,
  exportResultsJSON,
  generateSummary,
} from './evaluation/metrics';

// Lazy imports for subsystems (created by subagents)
let TopologyGraph: any;
let generateHierarchicalTopology: any;
let generateWaxmanTopology: any;
let generateBarabasiAlbertTopology: any;
let calculateTransferTime: any;
let NodeQueue: any;
let ResourceAllocator: any;

// Dynamic loader — resolves at runtime to avoid circular import issues
async function loadSubsystems(): Promise<void> {
  try {
    const topoMod = await import('./topology/graph');
    TopologyGraph = topoMod.TopologyGraph;
  } catch { /* subsystem not yet built */ }
  try {
    const genMod = await import('./topology/generators');
    generateHierarchicalTopology = genMod.generateHierarchical;
    generateWaxmanTopology = genMod.generateWaxman;
    generateBarabasiAlbertTopology = genMod.generateBarabasiAlbert;
  } catch { /* subsystem not yet built */ }
  try {
    const netMod = await import('./network/simulator');
    calculateTransferTime = netMod.calculateTransferTime;
  } catch { /* subsystem not yet built */ }
  try {
    const qMod = await import('./queueing/node-queue');
    NodeQueue = qMod.NodeQueue;
  } catch { /* subsystem not yet built */ }
  try {
    const resMod = await import('./resources/allocator');
    ResourceAllocator = resMod.ResourceAllocator;
  } catch { /* subsystem not yet built */ }
}

// ---------------------------------------------------------------------------
// Experiment Runner
// ---------------------------------------------------------------------------

export class ExperimentRunner {
  private config: ExperimentConfig;
  private subsystemsLoaded = false;

  constructor(config: ExperimentConfig) {
    this.config = config;
  }

  /**
   * Run all algorithms across all seeds.
   * Returns aggregated ExperimentResult per algorithm.
   */
  async runAll(): Promise<ExperimentResult[]> {
    if (!this.subsystemsLoaded) {
      await loadSubsystems();
      this.subsystemsLoaded = true;
    }

    const results: ExperimentResult[] = [];

    for (const algorithmName of this.config.algorithms) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Running algorithm: ${algorithmName}`);
      console.log(`${'='.repeat(60)}`);

      const runMetrics = [];

      for (let run = 0; run < this.config.numRuns; run++) {
        const seed = this.config.seeds[run];
        console.log(`  Run ${run + 1}/${this.config.numRuns} (seed: ${seed})...`);

        const metrics = this.executeSingleRun(algorithmName as SchedulerName, seed);
        runMetrics.push(metrics);

        console.log(`    Makespan: ${metrics.makespan.toFixed(2)}s, ` +
          `Avg Latency: ${metrics.avgLatency.toFixed(2)}s, ` +
          `SLA Violations: ${metrics.slaViolations}, ` +
          `Solver: ${metrics.solverTimeMs.toFixed(1)}ms`);
      }

      const aggregated = aggregateResults(this.config, algorithmName, runMetrics);
      results.push(aggregated);
    }

    return results;
  }

  /**
   * Execute a single simulation run for one algorithm with one seed.
   */
  private executeSingleRun(algorithmName: SchedulerName, seed: number): import('./types').RunMetrics {
    const rng = mulberry32(seed);

    // 1. Generate topology and nodes
    const { nodes, graph } = this.generateTopologyAndNodes(rng);

    // 2. Create subsystem instances
    const nodeQueues = new Map<string, any>();
    const nodeMap = new Map<string, SimNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (NodeQueue) {
        nodeQueues.set(node.id, new NodeQueue(
          node.id,
          node.queueDiscipline,
          1 / Math.max(0.1, 5 + rng() * 10), // service rate 5-15 tasks/sec
          this.config.queueModel,
        ));
      }
    }

    let allocator: any = null;
    if (ResourceAllocator) {
      allocator = new ResourceAllocator(nodeMap);
    }

    // 3. Create simulation hooks
    const hooks: SimulationHooks = {
      getTransferTime: (fromId: string, toId: string, dataSizeMB: number): number => {
        if (fromId === toId) return 0;
        if (calculateTransferTime && graph) {
          try {
            const result = calculateTransferTime(graph, fromId, toId, dataSizeMB, rng);
            return result.transferTimeSec;
          } catch {
            // Fallback if path doesn't exist
            return dataSizeMB / 100; // 100 MB/s baseline
          }
        }
        return dataSizeMB / 100;
      },

      getQueueWait: (nodeId: string): number => {
        const queue = nodeQueues.get(nodeId);
        if (queue) return queue.getExpectedWaitTime();
        return 0.1; // default 100ms
      },

      canAllocate: (nodeId: string, task: any): boolean => {
        const node = nodeMap.get(nodeId);
        if (!node || !node.alive) return false;
        if (allocator) {
          const result = allocator.canAllocate(nodeId, task.requirements);
          return result.feasible;
        }
        return true;
      },

      allocate: (nodeId: string, taskId: string, task: any): void => {
        if (allocator) {
          allocator.allocate(nodeId, taskId, task.requirements);
        }
      },

      release: (nodeId: string, taskId: string): void => {
        if (allocator) {
          allocator.release(nodeId, taskId);
        }
      },

      enqueue: (nodeId: string, task: any): void => {
        const queue = nodeQueues.get(nodeId);
        if (queue) queue.enqueue(task);
      },

      dequeue: (nodeId: string): any => {
        const queue = nodeQueues.get(nodeId);
        if (queue) return queue.dequeue();
        return null;
      },
    };

    // 4. Create scheduler
    const scheduler = createScheduler(algorithmName);

    // 5. Create simulation engine
    const engine = new SimulationEngine(this.config, scheduler, seed, hooks);

    // 6. Initialize
    engine.initializeNodes(nodes);

    // 7. Load workload
    const nodeIds = nodes.map((n) => n.id);
    const tasks = loadWorkload(
      this.config.workloadSource,
      nodeIds,
      this.config.taskCount,
      seed,
      this.config.workloadPath,
    );
    engine.loadTasks(tasks);

    // 8. Set up failures
    if (this.config.failureConfig.enabled) {
      engine.initializeFailures();
    }

    // 9. Set up scheduling ticks (every 1 second)
    engine.initializeScheduleTicks(1.0);

    // 10. Run simulation
    const result = engine.run();

    return result.metrics;
  }

  /**
   * Generate topology and SimNode array based on config.
   */
  private generateTopologyAndNodes(rng: () => number): { nodes: SimNode[]; graph: any } {
    const { nodeCount } = this.config;
    const nodes: SimNode[] = [];
    let nodeIndex = 0;

    // Create nodes per tier
    for (let i = 0; i < nodeCount.cloud; i++) {
      nodes.push(createSimNode(
        `cloud-${nodeIndex}`,
        `Cloud Node ${i}`,
        NodeTier.CLOUD,
        `region-${Math.floor(i / 2)}`,
      ));
      nodeIndex++;
    }

    for (let i = 0; i < nodeCount.fog; i++) {
      nodes.push(createSimNode(
        `fog-${nodeIndex}`,
        `Fog Node ${i}`,
        NodeTier.FOG,
        `region-${i % Math.max(1, Math.floor(nodeCount.cloud))}`,
      ));
      nodeIndex++;
    }

    for (let i = 0; i < nodeCount.edge; i++) {
      nodes.push(createSimNode(
        `edge-${nodeIndex}`,
        `Edge Node ${i}`,
        NodeTier.EDGE,
        `region-${i % Math.max(1, Math.floor(nodeCount.fog))}`,
      ));
      nodeIndex++;
    }

    for (let i = 0; i < nodeCount.device; i++) {
      nodes.push(createSimNode(
        `device-${nodeIndex}`,
        `Device ${i}`,
        NodeTier.DEVICE,
        `region-${i % Math.max(1, Math.floor(nodeCount.edge))}`,
      ));
      nodeIndex++;
    }

    // Generate topology graph
    let graph = null;
    if (generateHierarchicalTopology && this.config.topologyType === 'hierarchical') {
      graph = generateHierarchicalTopology({
        numCloud: nodeCount.cloud,
        numFogPerCloud: Math.max(1, Math.floor(nodeCount.fog / Math.max(1, nodeCount.cloud))),
        numEdgePerFog: Math.max(1, Math.floor(nodeCount.edge / Math.max(1, nodeCount.fog))),
        numDevicesPerEdge: Math.max(1, Math.floor(nodeCount.device / Math.max(1, nodeCount.edge))),
        seed: Math.floor(rng() * 2147483647),
      });
    } else if (generateWaxmanTopology && this.config.topologyType === 'waxman') {
      graph = generateWaxmanTopology({
        numNodes: nodes.length,
        alpha: Number(this.config.topologyParams.alpha) || 0.4,
        beta: Number(this.config.topologyParams.beta) || 0.4,
        seed: Math.floor(rng() * 2147483647),
      });
    } else if (generateBarabasiAlbertTopology && this.config.topologyType === 'barabasi-albert') {
      graph = generateBarabasiAlbertTopology({
        numNodes: nodes.length,
        m: Number(this.config.topologyParams.m) || 2,
        seed: Math.floor(rng() * 2147483647),
      });
    }

    return { nodes, graph };
  }
}

// ---------------------------------------------------------------------------
// CLI Entry Point for Experiments
// ---------------------------------------------------------------------------

export async function runExperimentCLI(configOverrides?: Partial<ExperimentConfig>): Promise<void> {
  const { createDefaultExperimentConfig } = await import('./config');
  const config = createDefaultExperimentConfig(configOverrides);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ML Task Scheduler — Research Simulation Platform           ║');
  console.log('║   Fog Computing Scheduling Experiment Runner                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Experiment: ${config.name}`);
  console.log(`Algorithms: ${config.algorithms.join(', ')}`);
  console.log(`Runs: ${config.numRuns}`);
  console.log(`Tasks: ${config.taskCount}`);
  console.log(`Topology: ${config.topologyType}`);
  console.log(`Workload: ${config.workloadSource}`);
  console.log(`Failures: ${config.failureConfig.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log('');

  const runner = new ExperimentRunner(config);
  const results = await runner.runAll();

  // Print summary
  console.log('\n');
  console.log(generateSummary(results));

  // Export results
  const fs = await import('fs');
  const path = await import('path');
  const outputDir = path.resolve(__dirname, '../../../results');

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch { /* exists */ }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = path.join(outputDir, `experiment-${timestamp}.csv`);
  const jsonPath = path.join(outputDir, `experiment-${timestamp}.json`);

  fs.writeFileSync(csvPath, exportResultsCSV(results), 'utf-8');
  fs.writeFileSync(jsonPath, exportResultsJSON(results), 'utf-8');

  console.log(`\nResults exported to:`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  JSON: ${jsonPath}`);
}
