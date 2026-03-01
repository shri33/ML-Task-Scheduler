/**
 * Experiments Routes - Unified experiment framework
 * Reproduces Figures 5-8 from Wang & Li (2019) paper:
 *   "Task Scheduling Based on a Hybrid Heuristic Algorithm
 *    for Smart Production Line with Fog Computing"
 *
 * Endpoints:
 *   POST /api/v1/experiments/run     – Run a specific experiment
 *   GET  /api/v1/experiments/results – List saved results
 *   GET  /api/v1/experiments/results/:id – Get specific result
 *   GET  /api/v1/experiments/summary – Summary report (JSON)
 */

import { Router, Request, Response } from 'express';
import {
  HybridHeuristicScheduler,
  fcfsSchedule,
  roundRobinSchedule,
  minMinSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';
import { authenticate, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import logger from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ─── Validation ─────────────────────────────────────────────────────────────
const experimentRequestSchema = z.object({
  experiment_type: z.enum([
    'energy',
    'reliability_taskcount',
    'reliability_tolerance',
    'completion_time',
    'all',
  ]),
  seed: z.number().int().optional().default(42),
  iterations: z.number().int().min(1).max(10).optional().default(3),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const RESULTS_DIR = path.resolve(__dirname, '../../results');
const TASK_COUNTS = [50, 100, 150, 200, 250, 300];
const TOLERANCE_TIMES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const FOG_NODE_COUNT = 10;

/** Seeded pseudo-random — ensures reproducibility */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Core experiment runners ────────────────────────────────────────────────

interface AlgoResult {
  delay: number;
  energy: number;
  reliability: number;
  time: number;
}

interface TaskCountRow {
  taskCount: number;
  hh: AlgoResult;
  ipso: AlgoResult;
  iaco: AlgoResult;
  rr: AlgoResult;
  minMin: AlgoResult;
}

interface ToleranceRow {
  maxToleranceTime: number;
  hh: number;
  ipso: number;
  iaco: number;
  rr: number;
}

function runAlgo(
  name: string,
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): AlgoResult {
  const start = Date.now();
  let result;
  switch (name) {
    case 'hh': {
      const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
      result = scheduler.schedule();
      break;
    }
    case 'ipso':
      result = ipsoOnlySchedule(tasks, fogNodes, devices);
      break;
    case 'iaco':
      result = iacoOnlySchedule(tasks, fogNodes, devices);
      break;
    case 'rr':
      result = roundRobinSchedule(tasks, fogNodes, devices);
      break;
    case 'minMin':
      result = minMinSchedule(tasks, fogNodes, devices);
      break;
    case 'fcfs':
      result = fcfsSchedule(tasks, fogNodes, devices);
      break;
    default:
      throw new Error(`Unknown algorithm: ${name}`);
  }
  return {
    delay: result.totalDelay,
    energy: result.totalEnergy,
    reliability: result.reliability,
    time: Date.now() - start,
  };
}

function runTaskCountExperiment(iterations: number): TaskCountRow[] {
  const results: TaskCountRow[] = [];
  for (const taskCount of TASK_COUNTS) {
    const agg: Record<string, AlgoResult> = {};
    ['hh', 'ipso', 'iaco', 'rr', 'minMin'].forEach(a => {
      agg[a] = { delay: 0, energy: 0, reliability: 0, time: 0 };
    });

    for (let i = 0; i < iterations; i++) {
      const fogNodes = generateSampleFogNodes(FOG_NODE_COUNT);
      const devices = generateSampleDevices(Math.min(taskCount, 30));
      const tasks = generateSampleTasks(taskCount, devices);

      for (const alg of ['hh', 'ipso', 'iaco', 'rr', 'minMin'] as const) {
        const r = runAlgo(alg, tasks, fogNodes, devices);
        agg[alg].delay += r.delay;
        agg[alg].energy += r.energy;
        agg[alg].reliability += r.reliability;
        agg[alg].time += r.time;
      }
    }

    const row: any = { taskCount };
    for (const alg of ['hh', 'ipso', 'iaco', 'rr', 'minMin']) {
      row[alg] = {
        delay: +(agg[alg].delay / iterations).toFixed(4),
        energy: +(agg[alg].energy / iterations).toFixed(4),
        reliability: +(agg[alg].reliability / iterations).toFixed(2),
        time: Math.round(agg[alg].time / iterations),
      };
    }
    results.push(row);
  }
  return results;
}

function runToleranceExperiment(): ToleranceRow[] {
  const results: ToleranceRow[] = [];
  const fogNodes = generateSampleFogNodes(FOG_NODE_COUNT);
  const devices = generateSampleDevices(20);

  for (const maxTime of TOLERANCE_TIMES) {
    const tasks: Task[] = [];
    for (let i = 0; i < 200; i++) {
      tasks.push({
        id: `task-${i}`,
        name: `Task-${i}`,
        dataSize: 10 + Math.random() * 40,
        computationIntensity: 200 + Math.random() * 200,
        maxToleranceTime: maxTime,
        expectedCompletionTime: maxTime * 0.5,
        terminalDeviceId: devices[i % devices.length].id,
        priority: Math.floor(Math.random() * 5) + 1,
      });
    }

    const hh = runAlgo('hh', tasks, fogNodes, devices);
    const ipso = runAlgo('ipso', tasks, fogNodes, devices);
    const iaco = runAlgo('iaco', tasks, fogNodes, devices);
    const rr = runAlgo('rr', tasks, fogNodes, devices);

    results.push({
      maxToleranceTime: maxTime,
      hh: +hh.reliability.toFixed(2),
      ipso: +ipso.reliability.toFixed(2),
      iaco: +iaco.reliability.toFixed(2),
      rr: +rr.reliability.toFixed(2),
    });
  }
  return results;
}

// ─── File export helpers ────────────────────────────────────────────────────

function saveEnergyCSV(rows: TaskCountRow[], dir: string) {
  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  rows.forEach(r => {
    csv += `${r.taskCount},${r.hh.energy},${r.ipso.energy},${r.iaco.energy},${r.rr.energy},${r.minMin.energy}\n`;
  });
  fs.writeFileSync(path.join(dir, 'energy_vs_taskcount.csv'), csv);
}

function saveCompletionCSV(rows: TaskCountRow[], dir: string) {
  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  rows.forEach(r => {
    csv += `${r.taskCount},${r.hh.delay},${r.ipso.delay},${r.iaco.delay},${r.rr.delay},${r.minMin.delay}\n`;
  });
  fs.writeFileSync(path.join(dir, 'completion_time_vs_taskcount.csv'), csv);
}

function saveReliabilityTasksCSV(rows: TaskCountRow[], dir: string) {
  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  rows.forEach(r => {
    csv += `${r.taskCount},${r.hh.reliability},${r.ipso.reliability},${r.iaco.reliability},${r.rr.reliability},${r.minMin.reliability}\n`;
  });
  fs.writeFileSync(path.join(dir, 'reliability_vs_taskcount.csv'), csv);
}

function saveToleranceCSV(rows: ToleranceRow[], dir: string) {
  let csv = 'MaxToleranceTime,HH,IPSO,IACO,RR\n';
  rows.forEach(r => {
    csv += `${r.maxToleranceTime},${r.hh},${r.ipso},${r.iaco},${r.rr}\n`;
  });
  fs.writeFileSync(path.join(dir, 'reliability_vs_tolerance.csv'), csv);
}

function buildSummaryReport(
  taskCountRows: TaskCountRow[] | null,
  toleranceRows: ToleranceRow[] | null,
) {
  const summary: Record<string, any> = {};
  const algos = ['hh', 'ipso', 'iaco', 'rr'] as const;

  for (const alg of algos) {
    const key = alg === 'hh' ? 'HH' : alg === 'rr' ? 'RR' : alg.toUpperCase();
    summary[key] = {
      energy: taskCountRows ? taskCountRows.map(r => (r as any)[alg].energy) : [],
      completion_time: taskCountRows ? taskCountRows.map(r => (r as any)[alg].delay) : [],
      reliability_taskcount: taskCountRows ? taskCountRows.map(r => (r as any)[alg].reliability) : [],
      reliability_tolerance: toleranceRows ? toleranceRows.map(r => (r as any)[alg]) : [],
    };
  }
  return summary;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/experiments/run
 * Body: { experiment_type: "energy"|"reliability_taskcount"|"reliability_tolerance"|"completion_time"|"all" }
 */
router.post('/run', adminOnly, async (req: Request, res: Response) => {
  try {
    const { experiment_type, iterations } = experimentRequestSchema.parse(req.body);

    logger.info(`Running experiment: ${experiment_type}, iterations=${iterations}`);
    const startTime = Date.now();

    let taskCountRows: TaskCountRow[] | null = null;
    let toleranceRows: ToleranceRow[] | null = null;
    const exportedFiles: string[] = [];

    // Run requested experiment(s)
    const needsTaskCount = ['energy', 'reliability_taskcount', 'completion_time', 'all'].includes(experiment_type);
    const needsTolerance = ['reliability_tolerance', 'all'].includes(experiment_type);

    if (needsTaskCount) {
      taskCountRows = runTaskCountExperiment(iterations);
    }
    if (needsTolerance) {
      toleranceRows = runToleranceExperiment();
    }

    // Ensure results directories
    const resultsRoot = RESULTS_DIR;
    ensureDir(resultsRoot);

    if (experiment_type === 'energy' || experiment_type === 'all') {
      const dir = path.join(resultsRoot, 'energy');
      ensureDir(dir);
      saveEnergyCSV(taskCountRows!, dir);
      fs.writeFileSync(
        path.join(dir, 'energy_vs_taskcount.json'),
        JSON.stringify({ taskCounts: TASK_COUNTS, data: taskCountRows!.map(r => ({ taskCount: r.taskCount, hh: r.hh.energy, ipso: r.ipso.energy, iaco: r.iaco.energy, rr: r.rr.energy })) }, null, 2)
      );
      exportedFiles.push('results/energy/energy_vs_taskcount.csv', 'results/energy/energy_vs_taskcount.json');
    }

    if (experiment_type === 'completion_time' || experiment_type === 'all') {
      const dir = path.join(resultsRoot, 'completion_time');
      ensureDir(dir);
      saveCompletionCSV(taskCountRows!, dir);
      exportedFiles.push('results/completion_time/completion_time_vs_taskcount.csv');
    }

    if (experiment_type === 'reliability_taskcount' || experiment_type === 'all') {
      const dir = path.join(resultsRoot, 'reliability_taskcount');
      ensureDir(dir);
      saveReliabilityTasksCSV(taskCountRows!, dir);
      exportedFiles.push('results/reliability_taskcount/reliability_vs_taskcount.csv');
    }

    if (experiment_type === 'reliability_tolerance' || experiment_type === 'all') {
      const dir = path.join(resultsRoot, 'reliability_tolerance');
      ensureDir(dir);
      saveToleranceCSV(toleranceRows!, dir);
      exportedFiles.push('results/reliability_tolerance/reliability_vs_tolerance.csv');
    }

    // Build and save summary report
    const summary = buildSummaryReport(taskCountRows, toleranceRows);
    fs.writeFileSync(
      path.join(resultsRoot, 'summary_report.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        experimentType: experiment_type,
        parameters: {
          fogNodes: FOG_NODE_COUNT,
          taskCounts: TASK_COUNTS,
          toleranceTimes: TOLERANCE_TIMES,
          iterations,
        },
        ...summary,
      }, null, 2)
    );
    exportedFiles.push('results/summary_report.json');

    const runtimeSeconds = +((Date.now() - startTime) / 1000).toFixed(2);

    // Validation checks
    const validation: Record<string, boolean> = {};
    if (taskCountRows) {
      // HH lowest energy across all task counts
      validation['hh_lowest_energy'] = taskCountRows.every(
        r => r.hh.energy <= r.ipso.energy && r.hh.energy <= r.iaco.energy && r.hh.energy <= r.rr.energy
      );
      // RR highest energy across all task counts
      validation['rr_highest_energy'] = taskCountRows.every(
        r => r.rr.energy >= r.hh.energy && r.rr.energy >= r.ipso.energy
      );
      // Reliability decreases with task number (HH)
      const hhRel = taskCountRows.map(r => r.hh.reliability);
      validation['reliability_decreases_with_tasks'] =
        hhRel[0] >= hhRel[hhRel.length - 1];
      // HH highest reliability
      validation['hh_highest_reliability'] = taskCountRows.every(
        r => r.hh.reliability >= r.rr.reliability
      );
    }
    if (toleranceRows) {
      // Reliability increases with tolerance time (HH)
      validation['reliability_increases_with_tolerance'] =
        toleranceRows[0].hh <= toleranceRows[toleranceRows.length - 1].hh;
      // HH highest reliability across all tolerance values
      validation['hh_highest_reliability_tolerance'] = toleranceRows.every(
        r => r.hh >= r.rr
      );
    }

    res.json({
      success: true,
      data: {
        experiment_type,
        runtimeSeconds,
        validation,
        exportedFiles,
        taskCountResults: taskCountRows,
        toleranceResults: toleranceRows,
        summary,
      },
    });
  } catch (error: any) {
    logger.error('Experiment error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run experiment' });
  }
});

/**
 * GET /api/v1/experiments/results
 * List saved experiment result files
 */
router.get('/results', async (_req: Request, res: Response) => {
  try {
    const results: string[] = [];

    function walk(dir: string, prefix: string) {
      if (!fs.existsSync(dir)) return;
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const rel = `${prefix}/${item}`;
        if (fs.statSync(full).isDirectory()) {
          walk(full, rel);
        } else {
          results.push(rel);
        }
      }
    }

    walk(RESULTS_DIR, 'results');
    res.json({ success: true, data: { files: results } });
  } catch (error) {
    res.json({ success: true, data: { files: [] } });
  }
});

/**
 * GET /api/v1/experiments/summary
 * Return the latest summary_report.json if it exists
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summaryPath = path.join(RESULTS_DIR, 'summary_report.json');
    if (!fs.existsSync(summaryPath)) {
      return res.status(404).json({ success: false, error: 'No summary report found. Run an experiment first.' });
    }
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read summary' });
  }
});

export default router;
