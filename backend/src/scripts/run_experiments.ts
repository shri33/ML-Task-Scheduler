#!/usr/bin/env ts-node
/**
 * Experiment Runner CLI
 * Reproduces Figures 5-8 from Wang & Li (2019):
 *   "Task Scheduling Based on a Hybrid Heuristic Algorithm
 *    for Smart Production Line with Fog Computing"
 *
 * Usage:
 *   npx ts-node src/scripts/run_experiments.ts --mode energy
 *   npx ts-node src/scripts/run_experiments.ts --mode reliability-tasks
 *   npx ts-node src/scripts/run_experiments.ts --mode reliability-tolerance
 *   npx ts-node src/scripts/run_experiments.ts --mode all
 *   npx ts-node src/scripts/run_experiments.ts --mode all --iterations 5 --seed 42
 */

import {
  HybridHeuristicScheduler,
  roundRobinSchedule,
  minMinSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  fcfsSchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';
import * as fs from 'fs';
import * as path from 'path';

// ─── CLI arg parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : defaultVal;
}

const MODE = getArg('--mode', 'all');
const ITERATIONS = parseInt(getArg('--iterations', '3'), 10);
const SEED = parseInt(getArg('--seed', '42'), 10);
const TASKS_FLAG = parseInt(getArg('--tasks', '200'), 10);
const NODES_FLAG = parseInt(getArg('--nodes', '10'), 10);
const ALGO_FLAG = getArg('--algo', 'HH');

const TASK_COUNTS = [50, 100, 150, 200, 250, 300];
const TOLERANCE_TIMES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const FOG_NODE_COUNT = NODES_FLAG;

const RESULTS_DIR = path.resolve(__dirname, '../../results');
function ensureDir(d: string) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ─── Algorithm runner ───────────────────────────────────────────────────────
interface AlgoResult {
  delay: number;
  energy: number;
  reliability: number;
  timeMs: number;
}

function run(name: string, tasks: Task[], nodes: FogNode[], devices: TerminalDevice[]): AlgoResult {
  const t0 = Date.now();
  let r;
  switch (name.toLowerCase()) {
    case 'hh': {
      const s = new HybridHeuristicScheduler(tasks, nodes, devices);
      r = s.schedule();
      break;
    }
    case 'ipso':  r = ipsoOnlySchedule(tasks, nodes, devices); break;
    case 'iaco':  r = iacoOnlySchedule(tasks, nodes, devices); break;
    case 'rr':    r = roundRobinSchedule(tasks, nodes, devices); break;
    case 'fcfs':  r = fcfsSchedule(tasks, nodes, devices); break;
    case 'minmin':r = minMinSchedule(tasks, nodes, devices); break;
    default: throw new Error(`Unknown algo: ${name}`);
  }
  return { delay: r.totalDelay, energy: r.totalEnergy, reliability: r.reliability, timeMs: Date.now() - t0 };
}

// ─── Experiment: Energy (Figure 6) ─────────────────────────────────────────
function experimentEnergy() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ENERGY CONSUMPTION EXPERIMENT (Figure 6)');
  console.log('══════════════════════════════════════════════════════');

  const dir = path.join(RESULTS_DIR, 'energy');
  ensureDir(dir);

  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  const jsonRows: any[] = [];

  for (const tc of TASK_COUNTS) {
    const agg: Record<string, number> = { hh: 0, ipso: 0, iaco: 0, rr: 0, minMin: 0 };
    for (let i = 0; i < ITERATIONS; i++) {
      const nodes = generateSampleFogNodes(FOG_NODE_COUNT);
      const devs = generateSampleDevices(Math.min(tc, 30));
      const tasks = generateSampleTasks(tc, devs);
      for (const a of Object.keys(agg)) {
        agg[a] += run(a === 'minMin' ? 'minmin' : a, tasks, nodes, devs).energy;
      }
    }
    const row = { taskCount: tc } as any;
    for (const a of Object.keys(agg)) { row[a] = +(agg[a] / ITERATIONS).toFixed(4); }
    jsonRows.push(row);
    csv += `${tc},${row.hh},${row.ipso},${row.iaco},${row.rr},${row.minMin}\n`;

    console.log(`  ${tc} tasks  => HH: ${row.hh}J | IPSO: ${row.ipso}J | IACO: ${row.iaco}J | RR: ${row.rr}J`);
  }

  fs.writeFileSync(path.join(dir, 'energy_vs_taskcount.csv'), csv);
  fs.writeFileSync(path.join(dir, 'energy_vs_taskcount.json'), JSON.stringify(jsonRows, null, 2));
  console.log(`  ✅ Saved to ${dir}`);
  return jsonRows;
}

// ─── Experiment: Reliability vs Task Count (Figure 7) ───────────────────────
function experimentReliabilityTasks() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  RELIABILITY vs TASK COUNT EXPERIMENT (Figure 7)');
  console.log('══════════════════════════════════════════════════════');

  const dir = path.join(RESULTS_DIR, 'reliability_taskcount');
  ensureDir(dir);

  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  const jsonRows: any[] = [];

  for (const tc of TASK_COUNTS) {
    const agg: Record<string, number> = { hh: 0, ipso: 0, iaco: 0, rr: 0, minMin: 0 };
    for (let i = 0; i < ITERATIONS; i++) {
      const nodes = generateSampleFogNodes(FOG_NODE_COUNT);
      const devs = generateSampleDevices(Math.min(tc, 30));
      const tasks = generateSampleTasks(tc, devs);
      for (const a of Object.keys(agg)) {
        agg[a] += run(a === 'minMin' ? 'minmin' : a, tasks, nodes, devs).reliability;
      }
    }
    const row = { taskCount: tc } as any;
    for (const a of Object.keys(agg)) { row[a] = +(agg[a] / ITERATIONS).toFixed(2); }
    jsonRows.push(row);
    csv += `${tc},${row.hh},${row.ipso},${row.iaco},${row.rr},${row.minMin}\n`;

    console.log(`  ${tc} tasks  => HH: ${row.hh}% | IPSO: ${row.ipso}% | IACO: ${row.iaco}% | RR: ${row.rr}%`);
  }

  fs.writeFileSync(path.join(dir, 'reliability_vs_taskcount.csv'), csv);
  fs.writeFileSync(path.join(dir, 'reliability_vs_taskcount.json'), JSON.stringify(jsonRows, null, 2));
  console.log(`  ✅ Saved to ${dir}`);
  return jsonRows;
}

// ─── Experiment: Reliability vs Tolerance (Figure 8) ────────────────────────
function experimentReliabilityTolerance() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  RELIABILITY vs TOLERANCE TIME EXPERIMENT (Figure 8)');
  console.log('══════════════════════════════════════════════════════');

  const dir = path.join(RESULTS_DIR, 'reliability_tolerance');
  ensureDir(dir);

  const nodes = generateSampleFogNodes(FOG_NODE_COUNT);
  const devs = generateSampleDevices(20);

  let csv = 'MaxToleranceTime,HH,IPSO,IACO,RR\n';
  const jsonRows: any[] = [];

  for (const mt of TOLERANCE_TIMES) {
    const tasks: Task[] = [];
    for (let i = 0; i < 200; i++) {
      tasks.push({
        id: `task-${i}`,
        name: `Task-${i}`,
        dataSize: 10 + Math.random() * 40,
        computationIntensity: 200 + Math.random() * 200,
        maxToleranceTime: mt,
        expectedCompletionTime: mt * 0.5,
        terminalDeviceId: devs[i % devs.length].id,
        priority: Math.floor(Math.random() * 5) + 1,
      });
    }

    const hh = run('hh', tasks, nodes, devs);
    const ipso = run('ipso', tasks, nodes, devs);
    const iaco = run('iaco', tasks, nodes, devs);
    const rr = run('rr', tasks, nodes, devs);

    const row = {
      maxToleranceTime: mt,
      hh: +hh.reliability.toFixed(2),
      ipso: +ipso.reliability.toFixed(2),
      iaco: +iaco.reliability.toFixed(2),
      rr: +rr.reliability.toFixed(2),
    };
    jsonRows.push(row);
    csv += `${mt},${row.hh},${row.ipso},${row.iaco},${row.rr}\n`;

    console.log(`  Tol=${mt}s => HH: ${row.hh}% | IPSO: ${row.ipso}% | IACO: ${row.iaco}% | RR: ${row.rr}%`);
  }

  fs.writeFileSync(path.join(dir, 'reliability_vs_tolerance.csv'), csv);
  fs.writeFileSync(path.join(dir, 'reliability_vs_tolerance.json'), JSON.stringify(jsonRows, null, 2));
  console.log(`  ✅ Saved to ${dir}`);
  return jsonRows;
}

// ─── Single simulation (matching paper's "simulate" requirement) ────────────
function simulateSingle() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  SIMULATION: ${TASKS_FLAG} tasks, ${NODES_FLAG} nodes, algo=${ALGO_FLAG}`);
  console.log('══════════════════════════════════════════════════════');

  const nodes = generateSampleFogNodes(NODES_FLAG);
  const devs = generateSampleDevices(Math.min(TASKS_FLAG, 30));
  const tasks = generateSampleTasks(TASKS_FLAG, devs);

  const memBefore = process.memoryUsage().heapUsed;
  const cpuBefore = process.cpuUsage();
  const result = run(ALGO_FLAG, tasks, nodes, devs);
  const cpuAfter = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage().heapUsed;

  console.log(`  Delay:       ${result.delay.toFixed(4)}s`);
  console.log(`  Energy:      ${result.energy.toFixed(4)}J`);
  console.log(`  Reliability: ${result.reliability.toFixed(2)}%`);
  console.log(`  Runtime:     ${result.timeMs}ms`);
  console.log(`  CPU (user):  ${(cpuAfter.user / 1000).toFixed(1)}ms`);
  console.log(`  CPU (sys):   ${(cpuAfter.system / 1000).toFixed(1)}ms`);
  console.log(`  Memory Δ:    ${((memAfter - memBefore) / 1024 / 1024).toFixed(2)} MB`);

  const logFile = path.join(RESULTS_DIR, 'simulation_log.json');
  ensureDir(RESULTS_DIR);
  fs.writeFileSync(logFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    tasks: TASKS_FLAG,
    nodes: NODES_FLAG,
    algorithm: ALGO_FLAG,
    ...result,
    scheduler_runtime_seconds: +(result.timeMs / 1000).toFixed(3),
    cpu_usage: { user_ms: +(cpuAfter.user / 1000).toFixed(1), system_ms: +(cpuAfter.system / 1000).toFixed(1) },
    memory_usage_mb: +((memAfter - memBefore) / 1024 / 1024).toFixed(2),
  }, null, 2));
  console.log(`  ✅ Log saved to ${logFile}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FOG COMPUTING EXPERIMENT RUNNER                             ║');
  console.log('║  Wang & Li (2019) - Hybrid Heuristic Algorithm               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${MODE} | Iterations: ${ITERATIONS} | Seed: ${SEED} | Nodes: ${FOG_NODE_COUNT}`);

  const t0 = Date.now();
  let energyRows, reliabilityTaskRows, toleranceRows;

  switch (MODE) {
    case 'energy':
      energyRows = experimentEnergy();
      break;
    case 'reliability-tasks':
      reliabilityTaskRows = experimentReliabilityTasks();
      break;
    case 'reliability-tolerance':
      toleranceRows = experimentReliabilityTolerance();
      break;
    case 'simulate':
      simulateSingle();
      break;
    case 'all':
      energyRows = experimentEnergy();
      reliabilityTaskRows = experimentReliabilityTasks();
      toleranceRows = experimentReliabilityTolerance();
      break;
    default:
      console.error(`Unknown mode: ${MODE}. Use: energy | reliability-tasks | reliability-tolerance | simulate | all`);
      process.exit(1);
  }

  // Save combined summary
  if (MODE !== 'simulate') {
    ensureDir(RESULTS_DIR);
    const summary: Record<string, any> = {
      generatedAt: new Date().toISOString(),
      mode: MODE,
      parameters: { fogNodes: FOG_NODE_COUNT, taskCounts: TASK_COUNTS, toleranceTimes: TOLERANCE_TIMES, iterations: ITERATIONS },
    };
    for (const alg of ['HH', 'IPSO', 'IACO', 'RR'] as const) {
      const key = alg.toLowerCase();
      summary[alg] = {
        energy: energyRows ? energyRows.map(r => (r as any)[key]) : [],
        reliability: reliabilityTaskRows ? reliabilityTaskRows.map(r => (r as any)[key]) : [],
        completion_time: energyRows ? energyRows.map((r: any) => r[key]) : [],
      };
    }
    fs.writeFileSync(path.join(RESULTS_DIR, 'summary_report.json'), JSON.stringify(summary, null, 2));
  }

  // Validation report
  if (MODE === 'all' || MODE === 'energy') {
    console.log('\n── VALIDATION ──────────────────────────────────────');
    if (energyRows) {
      const hhLowest = energyRows.every((r: any) => r.hh <= r.ipso && r.hh <= r.iaco && r.hh <= r.rr);
      const rrHighest = energyRows.every((r: any) => r.rr >= r.hh && r.rr >= r.ipso);
      console.log(`  [${hhLowest ? 'PASS' : 'FAIL'}] HH lowest energy across all task counts`);
      console.log(`  [${rrHighest ? 'PASS' : 'FAIL'}] RR highest energy across all task counts`);
    }
    if (reliabilityTaskRows) {
      const decr = reliabilityTaskRows[0].hh >= reliabilityTaskRows[reliabilityTaskRows.length - 1].hh;
      console.log(`  [${decr ? 'PASS' : 'FAIL'}] Reliability decreases with task number`);
    }
    if (toleranceRows) {
      const incr = toleranceRows[0].hh <= toleranceRows[toleranceRows.length - 1].hh;
      console.log(`  [${incr ? 'PASS' : 'FAIL'}] Reliability increases with tolerance time`);
    }
  }

  const totalSecs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Complete in ${totalSecs}s. Results: ${RESULTS_DIR}`);
}

main();
