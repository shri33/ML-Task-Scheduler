/**
 * Simulation Visualization API
 * =============================
 * REST endpoints for the frontend to visualize simulation state:
 *   - Topology graph (nodes + edges)
 *   - Task migration paths
 *   - Congestion heatmap
 *   - Queue utilization
 *   - Node failure timeline
 *   - Scheduler decision log
 *   - DAG execution timeline
 *   - Experiment results
 *
 * All endpoints are read-only (GET) and return JSON suitable
 * for frontend charting libraries (Recharts, D3, vis.js).
 */

import { Router, Request, Response } from 'express';
import {
  ExperimentRunner,
  createDefaultExperimentConfig,
  ALL_SCHEDULER_NAMES,
  ExperimentConfig,
  generateSyntheticWorkload,
  DEFAULT_SYNTHETIC_CONFIG,
} from '../simulation';

const router = Router();

// In-memory store for last experiment results (simple — no DB needed for research tool)
let lastExperimentResults: any[] = [];
let lastSimulationState: any = null;

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/topology
// Returns the current topology graph for visualization
// ---------------------------------------------------------------------------
router.get('/topology', async (_req: Request, res: Response) => {
  try {
    // Generate a sample topology for visualization
    const config = createDefaultExperimentConfig({
      nodeCount: { cloud: 2, fog: 4, edge: 8, device: 16 },
    });

    // Build topology description for frontend
    const nodes = [];
    const edges = [];
    let idx = 0;

    // Cloud nodes
    for (let i = 0; i < config.nodeCount.cloud; i++) {
      nodes.push({
        id: `cloud-${idx}`,
        label: `Cloud ${i}`,
        tier: 'CLOUD',
        group: 'cloud',
        x: 400 + i * 200,
        y: 50,
        size: 40,
        color: '#4A90D9',
      });
      idx++;
    }

    // Fog nodes
    for (let i = 0; i < config.nodeCount.fog; i++) {
      const parentCloud = `cloud-${i % config.nodeCount.cloud}`;
      nodes.push({
        id: `fog-${idx}`,
        label: `Fog ${i}`,
        tier: 'FOG',
        group: 'fog',
        x: 200 + i * 150,
        y: 200,
        size: 30,
        color: '#7B68EE',
      });
      edges.push({
        source: parentCloud,
        target: `fog-${idx}`,
        latencyMs: 20 + Math.random() * 30,
        bandwidthMbps: 1000 + Math.random() * 9000,
        utilization: Math.random() * 0.6,
      });
      idx++;
    }

    // Edge nodes
    for (let i = 0; i < config.nodeCount.edge; i++) {
      const parentFog = `fog-${config.nodeCount.cloud + (i % config.nodeCount.fog)}`;
      nodes.push({
        id: `edge-${idx}`,
        label: `Edge ${i}`,
        tier: 'EDGE',
        group: 'edge',
        x: 100 + i * 100,
        y: 350,
        size: 20,
        color: '#2ECC71',
      });
      edges.push({
        source: parentFog,
        target: `edge-${idx}`,
        latencyMs: 5 + Math.random() * 20,
        bandwidthMbps: 100 + Math.random() * 900,
        utilization: Math.random() * 0.8,
      });
      idx++;
    }

    // Device nodes
    for (let i = 0; i < config.nodeCount.device; i++) {
      const parentEdge = `edge-${config.nodeCount.cloud + config.nodeCount.fog + (i % config.nodeCount.edge)}`;
      nodes.push({
        id: `device-${idx}`,
        label: `Dev ${i}`,
        tier: 'DEVICE',
        group: 'device',
        x: 50 + i * 60,
        y: 500,
        size: 12,
        color: '#E67E22',
      });
      edges.push({
        source: parentEdge,
        target: `device-${idx}`,
        latencyMs: 1 + Math.random() * 10,
        bandwidthMbps: 10 + Math.random() * 90,
        utilization: Math.random() * 0.5,
      });
      idx++;
    }

    res.json({
      success: true,
      data: { nodes, edges, summary: { total: nodes.length, tiers: config.nodeCount } },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'TOPOLOGY_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/congestion
// Returns congestion heatmap data (node utilization)
// ---------------------------------------------------------------------------
router.get('/congestion', async (_req: Request, res: Response) => {
  try {
    const config = createDefaultExperimentConfig();
    const totalNodes = config.nodeCount.cloud + config.nodeCount.fog + config.nodeCount.edge + config.nodeCount.device;

    // Generate utilization data per node
    const heatmapData = [];
    const tiers = ['CLOUD', 'FOG', 'EDGE', 'DEVICE'] as const;
    const counts = [config.nodeCount.cloud, config.nodeCount.fog, config.nodeCount.edge, config.nodeCount.device];

    let nodeIdx = 0;
    for (let t = 0; t < tiers.length; t++) {
      for (let i = 0; i < counts[t]; i++) {
        // Simulate utilization over time (24 time points)
        const history = Array.from({ length: 24 }, (_, ts) => ({
          timestamp: ts,
          cpuUtil: Math.min(1, Math.random() * (0.3 + t * 0.15) + Math.sin(ts / 4) * 0.2),
          memUtil: Math.min(1, Math.random() * (0.4 + t * 0.1)),
          queueLength: Math.floor(Math.random() * (10 + t * 5)),
          networkUtil: Math.min(1, Math.random() * (0.2 + t * 0.2)),
        }));

        heatmapData.push({
          nodeId: `${tiers[t].toLowerCase()}-${nodeIdx}`,
          tier: tiers[t],
          history,
          avgCpuUtil: history.reduce((s, h) => s + h.cpuUtil, 0) / history.length,
          avgQueueLength: history.reduce((s, h) => s + h.queueLength, 0) / history.length,
        });
        nodeIdx++;
      }
    }

    res.json({
      success: true,
      data: { heatmap: heatmapData, timePoints: 24 },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CONGESTION_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/queue-stats
// Returns queue utilization data per node
// ---------------------------------------------------------------------------
router.get('/queue-stats', async (_req: Request, res: Response) => {
  try {
    const queueStats = ['CLOUD', 'FOG', 'EDGE', 'DEVICE'].flatMap((tier, tierIdx) => {
      return Array.from({ length: [2, 4, 8, 16][tierIdx] }, (_, i) => ({
        nodeId: `${tier.toLowerCase()}-${i}`,
        tier,
        queueLength: Math.floor(Math.random() * 20),
        arrivalRate: (0.5 + Math.random() * 5).toFixed(2),
        serviceRate: (1 + Math.random() * 10).toFixed(2),
        utilization: (Math.random() * 0.95).toFixed(3),
        expectedWaitTime: (Math.random() * 5).toFixed(3),
        discipline: ['WFQ', 'PRIORITY', 'EDF', 'FCFS'][tierIdx],
      }));
    });

    res.json({
      success: true,
      data: { queues: queueStats },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUEUE_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/simulation/run
// Run a simulation experiment
// ---------------------------------------------------------------------------
router.post('/run', async (req: Request, res: Response) => {
  try {
    const userConfig = req.body as Partial<ExperimentConfig>;
    const config = createDefaultExperimentConfig({
      numRuns: Math.min(30, userConfig.numRuns || 5),
      taskCount: Math.min(1000, userConfig.taskCount || 50),
      algorithms: userConfig.algorithms || ['FCFS', 'SJF', 'EDF', 'MIN_MIN', 'IPSO', 'IACO', 'HH'],
      ...userConfig,
    });

    const runner = new ExperimentRunner(config);
    const results = await runner.runAll();
    lastExperimentResults = results;

    const { generateSummary: genSummary } = await import('../simulation/evaluation/metrics');
    const summary = genSummary(results);

    res.json({
      success: true,
      data: {
        results: results.map((r) => ({
          algorithm: r.algorithm,
          mean: r.mean,
          stddev: r.stddev,
          ci95Lower: r.ci95Lower,
          ci95Upper: r.ci95Upper,
          numRuns: r.runs.length,
        })),
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'SIMULATION_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/results
// Returns the last experiment results
// ---------------------------------------------------------------------------
router.get('/results', async (_req: Request, res: Response) => {
  if (lastExperimentResults.length === 0) {
    return res.json({ success: true, data: { results: [], message: 'No experiments run yet' } });
  }

  res.json({
    success: true,
    data: {
      results: lastExperimentResults.map((r: any) => ({
        algorithm: r.algorithm,
        mean: r.mean,
        stddev: r.stddev,
        ci95Lower: r.ci95Lower,
        ci95Upper: r.ci95Upper,
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/algorithms
// Returns available scheduling algorithms
// ---------------------------------------------------------------------------
router.get('/algorithms', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      algorithms: ALL_SCHEDULER_NAMES.map((name) => ({
        name,
        category: ['IPSO', 'IACO', 'HH'].includes(name)
          ? 'metaheuristic'
          : ['SJF', 'EDF', 'MIN_MIN'].includes(name)
            ? 'heuristic'
            : 'baseline',
        description: getAlgorithmDescription(name),
      })),
      dagAlgorithms: ['HEFT', 'CPOP', 'PEFT'],
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/config
// Returns default experiment configuration
// ---------------------------------------------------------------------------
router.get('/config', (_req: Request, res: Response) => {
  const config = createDefaultExperimentConfig();
  res.json({ success: true, data: config });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulation/workload-preview
// Preview a synthetic workload
// ---------------------------------------------------------------------------
router.get('/workload-preview', (req: Request, res: Response) => {
  try {
    const count = Math.min(500, parseInt(req.query.count as string) || 50);
    const seed = parseInt(req.query.seed as string) || 42;

    const tasks = generateSyntheticWorkload({
      ...DEFAULT_SYNTHETIC_CONFIG,
      taskCount: count,
      nodeIds: ['node-0', 'node-1', 'node-2', 'node-3', 'node-4'],
      seed,
    });

    res.json({
      success: true,
      data: {
        tasks: tasks.map((t) => ({
          id: t.id,
          category: t.category,
          cpuCores: t.requirements.cpuCores,
          memoryMB: t.requirements.memoryMB,
          vramMB: t.requirements.vramMB,
          dataSizeMB: t.dataSizeMB,
          estimatedExecTime: t.estimatedExecTime,
          deadline: t.deadline,
          priority: t.priority,
          submitTime: t.submitTime,
          dependencies: t.dependencies,
          checkpointable: t.checkpointable,
        })),
        summary: {
          count: tasks.length,
          avgExecTime: tasks.reduce((s, t) => s + t.estimatedExecTime, 0) / tasks.length,
          avgDataSize: tasks.reduce((s, t) => s + t.dataSizeMB, 0) / tasks.length,
          gpuTasks: tasks.filter((t) => t.requirements.vramMB > 0).length,
          dagTasks: tasks.filter((t) => t.dependencies.length > 0).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'WORKLOAD_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAlgorithmDescription(name: string): string {
  const descriptions: Record<string, string> = {
    FCFS: 'First Come First Served — baseline FIFO scheduling',
    ROUND_ROBIN: 'Round Robin — cyclic assignment across nodes',
    SJF: 'Shortest Job First — minimizes average completion time',
    EDF: 'Earliest Deadline First — prioritizes urgent tasks',
    MIN_MIN: 'Min-Min — iteratively assigns task with smallest minimum completion time',
    IPSO: 'Improved Particle Swarm Optimization — Wang & Li (2019) metaheuristic',
    IACO: 'Improved Ant Colony Optimization — Wang & Li (2019) with MMAS bounds',
    HH: 'Hybrid Heuristic — two-phase IPSO→IACO (Wang & Li 2019)',
  };
  return descriptions[name] || 'Unknown algorithm';
}

export default router;
