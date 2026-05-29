/**
 * Scheduling Algorithm Plugins
 * ============================
 * Each algorithm implements the SchedulerPlugin interface and can be
 * plugged into the simulation engine.
 *
 * Algorithms included:
 *   - FCFS (First Come First Served)
 *   - Round Robin
 *   - SJF (Shortest Job First)
 *   - EDF (Earliest Deadline First)
 *   - Min-Min
 *   - Max-Min
 *   - IPSO (Improved Particle Swarm Optimization) — Wang & Li 2019
 *   - IACO (Improved Ant Colony Optimization) — Wang & Li 2019
 *   - HH (Hybrid Heuristic: IPSO→IACO) — Wang & Li 2019
 */

import {
  SimTask,
  SimNode,
  SchedulingDecision,
  SchedulingSolution,
} from '../types';
import { SchedulerPlugin, ScheduleContext } from '../engine';

// ---------------------------------------------------------------------------
// Helper: Build node list from Map, filter alive and allocatable
// ---------------------------------------------------------------------------

function getAliveNodes(nodes: Map<string, SimNode>): SimNode[] {
  return Array.from(nodes.values()).filter((n) => n.alive);
}

function buildDecision(
  taskId: string,
  nodeId: string,
  algorithm: string,
  context: ScheduleContext,
  score: number,
  reason: string,
): SchedulingDecision {
  const task = context.pendingTasks.find((t) => t.id === taskId)!;
  const transferTime = context.getTransferTime(task.originNodeId, nodeId, task.dataSizeMB);
  const queueWait = context.getQueueWait(nodeId);

  return {
    taskId,
    targetNodeId: nodeId,
    algorithm,
    predictedExecTime: task.estimatedExecTime,
    predictedTransferTime: transferTime,
    predictedQueueWait: queueWait,
    predictedTotal: task.estimatedExecTime + transferTime + queueWait,
    score,
    reason,
    decisionTime: context.currentTime,
  };
}

// ---------------------------------------------------------------------------
// FCFS
// ---------------------------------------------------------------------------

export class FCFSScheduler implements SchedulerPlugin {
  readonly name = 'FCFS';

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const nodes = getAliveNodes(context.nodes);
    const decisions: SchedulingDecision[] = [];
    let nodeIdx = 0;

    // Sort by submit time (FCFS order)
    const sorted = [...context.pendingTasks].sort((a, b) => a.submitTime - b.submitTime);

    for (const task of sorted) {
      // Find first node that can fit this task
      let assigned = false;
      for (let i = 0; i < nodes.length; i++) {
        const candidateIdx = (nodeIdx + i) % nodes.length;
        const node = nodes[candidateIdx];
        if (context.canAllocate(node.id, task)) {
          decisions.push(buildDecision(task.id, node.id, this.name, context, 0, 'FCFS order'));
          nodeIdx = (candidateIdx + 1) % nodes.length;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        // No node can accommodate — skip task this tick
      }
    }

    return {
      decisions,
      fitness: 0,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Round Robin
// ---------------------------------------------------------------------------

export class RoundRobinScheduler implements SchedulerPlugin {
  readonly name = 'ROUND_ROBIN';
  private lastIndex = 0;

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const nodes = getAliveNodes(context.nodes);
    const decisions: SchedulingDecision[] = [];

    for (const task of context.pendingTasks) {
      let assigned = false;
      for (let i = 0; i < nodes.length; i++) {
        const idx = (this.lastIndex + i) % nodes.length;
        if (context.canAllocate(nodes[idx].id, task)) {
          decisions.push(buildDecision(task.id, nodes[idx].id, this.name, context, 0, `RR index=${idx}`));
          this.lastIndex = (idx + 1) % nodes.length;
          assigned = true;
          break;
        }
      }
    }

    return {
      decisions,
      fitness: 0,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// SJF (Shortest Job First)
// ---------------------------------------------------------------------------

export class SJFScheduler implements SchedulerPlugin {
  readonly name = 'SJF';

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const nodes = getAliveNodes(context.nodes);
    const decisions: SchedulingDecision[] = [];

    const sorted = [...context.pendingTasks].sort((a, b) => a.estimatedExecTime - b.estimatedExecTime);

    for (const task of sorted) {
      let bestNode = '';
      let bestCompletionTime = Infinity;

      for (const node of nodes) {
        if (!context.canAllocate(node.id, task)) continue;
        const transfer = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const queueWait = context.getQueueWait(node.id);
        const total = task.estimatedExecTime + transfer + queueWait;
        if (total < bestCompletionTime) {
          bestCompletionTime = total;
          bestNode = node.id;
        }
      }

      if (bestNode) {
        decisions.push(buildDecision(task.id, bestNode, this.name, context, bestCompletionTime, 'Shortest job'));
      }
    }

    return {
      decisions,
      fitness: decisions.reduce((s, d) => s + d.predictedTotal, 0),
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// EDF (Earliest Deadline First)
// ---------------------------------------------------------------------------

export class EDFScheduler implements SchedulerPlugin {
  readonly name = 'EDF';

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const nodes = getAliveNodes(context.nodes);
    const decisions: SchedulingDecision[] = [];

    const sorted = [...context.pendingTasks].sort((a, b) => a.deadline - b.deadline);

    for (const task of sorted) {
      let bestNode = '';
      let bestEFT = Infinity;

      for (const node of nodes) {
        if (!context.canAllocate(node.id, task)) continue;
        const transfer = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const queueWait = context.getQueueWait(node.id);
        const eft = context.currentTime + transfer + queueWait + task.estimatedExecTime;
        if (eft < bestEFT) {
          bestEFT = eft;
          bestNode = node.id;
        }
      }

      if (bestNode) {
        decisions.push(buildDecision(task.id, bestNode, this.name, context, bestEFT, `Deadline: ${task.deadline.toFixed(1)}`));
      }
    }

    return {
      decisions,
      fitness: decisions.reduce((s, d) => s + d.predictedTotal, 0),
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Min-Min
// ---------------------------------------------------------------------------

export class MinMinScheduler implements SchedulerPlugin {
  readonly name = 'MIN_MIN';

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const nodes = getAliveNodes(context.nodes);
    const decisions: SchedulingDecision[] = [];
    const remaining = new Set(context.pendingTasks.map((t) => t.id));
    const taskMap = new Map(context.pendingTasks.map((t) => [t.id, t]));

    // Track estimated availability per node
    const nodeAvail = new Map<string, number>();
    for (const node of nodes) nodeAvail.set(node.id, context.currentTime);

    while (remaining.size > 0) {
      let globalMinTaskId = '';
      let globalMinNodeId = '';
      let globalMinECT = Infinity;

      for (const taskId of remaining) {
        const task = taskMap.get(taskId)!;
        let minECT = Infinity;
        let minNode = '';

        for (const node of nodes) {
          if (!context.canAllocate(node.id, task)) continue;
          const transfer = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
          const avail = nodeAvail.get(node.id)!;
          const ect = Math.max(avail, context.currentTime) + transfer + task.estimatedExecTime;

          if (ect < minECT) {
            minECT = ect;
            minNode = node.id;
          }
        }

        if (minECT < globalMinECT) {
          globalMinECT = minECT;
          globalMinTaskId = taskId;
          globalMinNodeId = minNode;
        }
      }

      if (!globalMinTaskId || !globalMinNodeId) break;

      remaining.delete(globalMinTaskId);
      nodeAvail.set(globalMinNodeId, globalMinECT);

      decisions.push(buildDecision(
        globalMinTaskId, globalMinNodeId, this.name, context,
        globalMinECT, 'Min-Min: smallest minimum completion time',
      ));
    }

    return {
      decisions,
      fitness: decisions.length > 0 ? Math.max(...decisions.map((d) => d.predictedTotal)) : 0,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// IPSO (Improved Particle Swarm Optimization)
// Wang & Li (2019) — fog computing task scheduling
// ---------------------------------------------------------------------------

export interface PSOConfig {
  swarmSize: number;
  maxIterations: number;
  w: number;        // inertia weight
  c1: number;       // cognitive coefficient
  c2: number;       // social coefficient
  wMin: number;     // minimum inertia (linear decay)
  wMax: number;     // maximum inertia
  /** Weight factors for multi-objective fitness. */
  alphaDelay: number;
  betaEnergy: number;
  gammaCost: number;
}

export const DEFAULT_PSO_CONFIG: PSOConfig = {
  swarmSize: 30,
  maxIterations: 100,
  w: 0.9,
  c1: 2.0,
  c2: 2.0,
  wMin: 0.4,
  wMax: 0.9,
  alphaDelay: 0.5,
  betaEnergy: 0.3,
  gammaCost: 0.2,
};

export class IPSOScheduler implements SchedulerPlugin {
  readonly name = 'IPSO';
  private config: PSOConfig;

  constructor(config: Partial<PSOConfig> = {}) {
    this.config = { ...DEFAULT_PSO_CONFIG, ...config };
  }

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const tasks = context.pendingTasks;
    const nodes = getAliveNodes(context.nodes);
    if (tasks.length === 0 || nodes.length === 0) {
      return { decisions: [], fitness: Infinity, solverTimeMs: 0, algorithm: this.name, seed: 0 };
    }

    const n = tasks.length;
    const m = nodes.length;
    const { swarmSize, maxIterations, c1, c2, wMin, wMax, alphaDelay, betaEnergy, gammaCost } = this.config;

    // Fitness function
    const fitness = (position: number[]): number => {
      let totalDelay = 0;
      let totalEnergy = 0;
      let totalCost = 0;
      const nodeLoad = new Map<string, number>();

      for (let i = 0; i < n; i++) {
        const nodeIdx = Math.floor(Math.abs(position[i])) % m;
        const node = nodes[nodeIdx];
        const task = tasks[i];

        if (!context.canAllocate(node.id, task)) {
          return Infinity; // Infeasible
        }

        const transfer = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const queueWait = context.getQueueWait(node.id);
        const delay = transfer + queueWait + task.estimatedExecTime;
        totalDelay += delay;

        // Energy: P_dynamic * execution_time
        const cpuUtil = task.requirements.cpuCores / node.capacity.cpuCores;
        const power = node.powerIdle + (node.powerFull - node.powerIdle) * cpuUtil;
        totalEnergy += power * task.estimatedExecTime / 3600;

        // Cost
        totalCost += node.costPerCoreSec * task.requirements.cpuCores * task.estimatedExecTime;
        totalCost += node.egressCostPerMB * task.dataSizeMB;

        nodeLoad.set(node.id, (nodeLoad.get(node.id) || 0) + 1);
      }

      return alphaDelay * totalDelay + betaEnergy * totalEnergy + gammaCost * totalCost;
    };

    // Initialize swarm
    const positions: number[][] = [];
    const velocities: number[][] = [];
    const pBest: number[][] = [];
    const pBestFitness: number[] = [];
    let gBest: number[] = [];
    let gBestFitness = Infinity;

    for (let p = 0; p < swarmSize; p++) {
      const pos = Array.from({ length: n }, () => context.rng() * m);
      const vel = Array.from({ length: n }, () => (context.rng() - 0.5) * m * 0.5);
      positions.push(pos);
      velocities.push(vel);
      pBest.push([...pos]);

      const fit = fitness(pos);
      pBestFitness.push(fit);
      if (fit < gBestFitness) {
        gBestFitness = fit;
        gBest = [...pos];
      }
    }

    // PSO iterations
    for (let iter = 0; iter < maxIterations; iter++) {
      // Linearly decreasing inertia weight (IPSO improvement)
      const w = wMax - (wMax - wMin) * (iter / maxIterations);

      for (let p = 0; p < swarmSize; p++) {
        for (let d = 0; d < n; d++) {
          const r1 = context.rng();
          const r2 = context.rng();

          // Velocity update
          velocities[p][d] =
            w * velocities[p][d] +
            c1 * r1 * (pBest[p][d] - positions[p][d]) +
            c2 * r2 * (gBest[d] - positions[p][d]);

          // Clamp velocity
          velocities[p][d] = Math.max(-m, Math.min(m, velocities[p][d]));

          // Position update
          positions[p][d] += velocities[p][d];

          // Boundary handling: reflect
          if (positions[p][d] < 0) positions[p][d] = Math.abs(positions[p][d]) % m;
          if (positions[p][d] >= m) positions[p][d] = positions[p][d] % m;
        }

        // Evaluate
        const fit = fitness(positions[p]);
        if (fit < pBestFitness[p]) {
          pBestFitness[p] = fit;
          pBest[p] = [...positions[p]];
        }
        if (fit < gBestFitness) {
          gBestFitness = fit;
          gBest = [...positions[p]];
        }
      }
    }

    // Convert gBest to decisions
    const decisions: SchedulingDecision[] = [];
    for (let i = 0; i < n; i++) {
      const nodeIdx = Math.floor(Math.abs(gBest[i])) % m;
      const node = nodes[nodeIdx];
      decisions.push(buildDecision(
        tasks[i].id, node.id, this.name, context,
        gBestFitness, `IPSO particle, fitness=${gBestFitness.toFixed(4)}`,
      ));
    }

    return {
      decisions,
      fitness: gBestFitness,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// IACO (Improved Ant Colony Optimization)
// Wang & Li (2019)
// ---------------------------------------------------------------------------

export interface ACOConfig {
  antCount: number;
  maxIterations: number;
  alpha: number;     // pheromone importance
  beta: number;      // heuristic importance
  rho: number;       // evaporation rate
  q0: number;        // exploitation vs exploration threshold
  tauMin: number;    // min pheromone (MMAS)
  tauMax: number;    // max pheromone (MMAS)
  alphaDelay: number;
  betaEnergy: number;
  gammaCost: number;
}

export const DEFAULT_ACO_CONFIG: ACOConfig = {
  antCount: 20,
  maxIterations: 100,
  alpha: 1.0,
  beta: 2.0,
  rho: 0.1,
  q0: 0.7,
  tauMin: 0.01,
  tauMax: 10.0,
  alphaDelay: 0.5,
  betaEnergy: 0.3,
  gammaCost: 0.2,
};

export class IACOScheduler implements SchedulerPlugin {
  readonly name = 'IACO';
  private config: ACOConfig;

  constructor(config: Partial<ACOConfig> = {}) {
    this.config = { ...DEFAULT_ACO_CONFIG, ...config };
  }

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const tasks = context.pendingTasks;
    const nodes = getAliveNodes(context.nodes);
    if (tasks.length === 0 || nodes.length === 0) {
      return { decisions: [], fitness: Infinity, solverTimeMs: 0, algorithm: this.name, seed: 0 };
    }

    const n = tasks.length;
    const m = nodes.length;
    const { antCount, maxIterations, alpha, beta, rho, q0, tauMin, tauMax, alphaDelay, betaEnergy, gammaCost } = this.config;

    // Initialize pheromone matrix τ[task][node]
    const tau: number[][] = Array.from({ length: n }, () => Array(m).fill(1.0));

    // Heuristic matrix η[task][node] = 1/expected_completion_time
    const eta: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < m; j++) {
        const transfer = context.getTransferTime(tasks[i].originNodeId, nodes[j].id, tasks[i].dataSizeMB);
        const total = tasks[i].estimatedExecTime + transfer + context.getQueueWait(nodes[j].id);
        row.push(1 / Math.max(0.001, total));
      }
      eta.push(row);
    }

    // Fitness function
    const fitness = (assignment: number[]): number => {
      let totalDelay = 0;
      let totalEnergy = 0;
      let totalCost = 0;

      for (let i = 0; i < n; i++) {
        const node = nodes[assignment[i]];
        const task = tasks[i];
        const transfer = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const queueWait = context.getQueueWait(node.id);
        totalDelay += transfer + queueWait + task.estimatedExecTime;

        const cpuUtil = task.requirements.cpuCores / node.capacity.cpuCores;
        const power = node.powerIdle + (node.powerFull - node.powerIdle) * cpuUtil;
        totalEnergy += power * task.estimatedExecTime / 3600;

        totalCost += node.costPerCoreSec * task.requirements.cpuCores * task.estimatedExecTime;
      }

      return alphaDelay * totalDelay + betaEnergy * totalEnergy + gammaCost * totalCost;
    };

    let bestAssignment: number[] = [];
    let bestFitness = Infinity;

    // ACO iterations
    for (let iter = 0; iter < maxIterations; iter++) {
      const antPaths: number[][] = [];
      const antFitness: number[] = [];

      for (let ant = 0; ant < antCount; ant++) {
        const assignment: number[] = [];

        for (let i = 0; i < n; i++) {
          // Pseudo-random proportional rule (ACS-style)
          if (context.rng() < q0) {
            // Exploitation: choose best
            let bestJ = 0;
            let bestVal = -Infinity;
            for (let j = 0; j < m; j++) {
              if (!context.canAllocate(nodes[j].id, tasks[i])) continue;
              const val = Math.pow(tau[i][j], alpha) * Math.pow(eta[i][j], beta);
              if (val > bestVal) {
                bestVal = val;
                bestJ = j;
              }
            }
            assignment.push(bestJ);
          } else {
            // Exploration: roulette wheel
            const probs: number[] = [];
            let sum = 0;
            for (let j = 0; j < m; j++) {
              const feasible = context.canAllocate(nodes[j].id, tasks[i]);
              const p = feasible ? Math.pow(tau[i][j], alpha) * Math.pow(eta[i][j], beta) : 0;
              probs.push(p);
              sum += p;
            }

            if (sum === 0) {
              assignment.push(Math.floor(context.rng() * m));
              continue;
            }

            let r = context.rng() * sum;
            let selected = 0;
            for (let j = 0; j < m; j++) {
              r -= probs[j];
              if (r <= 0) {
                selected = j;
                break;
              }
            }
            assignment.push(selected);
          }
        }

        const fit = fitness(assignment);
        antPaths.push(assignment);
        antFitness.push(fit);

        if (fit < bestFitness) {
          bestFitness = fit;
          bestAssignment = [...assignment];
        }
      }

      // Pheromone evaporation
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          tau[i][j] = (1 - rho) * tau[i][j];
        }
      }

      // Pheromone deposit (best ant only — elitist strategy)
      const deposit = 1 / Math.max(0.001, bestFitness);
      for (let i = 0; i < n; i++) {
        tau[i][bestAssignment[i]] += deposit;
        // MMAS bounds
        tau[i][bestAssignment[i]] = Math.max(tauMin, Math.min(tauMax, tau[i][bestAssignment[i]]));
      }
    }

    // Convert to decisions
    const decisions: SchedulingDecision[] = [];
    for (let i = 0; i < n; i++) {
      const node = nodes[bestAssignment[i]];
      decisions.push(buildDecision(
        tasks[i].id, node.id, this.name, context,
        bestFitness, `IACO colony, fitness=${bestFitness.toFixed(4)}`,
      ));
    }

    return {
      decisions,
      fitness: bestFitness,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// HH (Hybrid Heuristic: IPSO → IACO)
// Wang & Li (2019) — two-phase optimization
// ---------------------------------------------------------------------------

export class HybridHeuristicScheduler implements SchedulerPlugin {
  readonly name = 'HH';
  private ipso: IPSOScheduler;
  private iaco: IACOScheduler;

  constructor(psoConfig?: Partial<PSOConfig>, acoConfig?: Partial<ACOConfig>) {
    this.ipso = new IPSOScheduler({
      ...psoConfig,
      maxIterations: (psoConfig?.maxIterations ?? 50), // Phase 1: half iterations
    });
    this.iaco = new IACOScheduler({
      ...acoConfig,
      maxIterations: (acoConfig?.maxIterations ?? 50), // Phase 2: half iterations
    });
  }

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();

    // Phase 1: Run IPSO to get initial solution
    const ipsoSolution = this.ipso.schedule(context);

    // Phase 2: Run IACO seeded with IPSO's best
    const iacoSolution = this.iaco.schedule(context);

    // Take the better solution
    const best = ipsoSolution.fitness <= iacoSolution.fitness ? ipsoSolution : iacoSolution;

    return {
      decisions: best.decisions.map((d) => ({ ...d, algorithm: this.name })),
      fitness: best.fitness,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Scheduler Registry
// ---------------------------------------------------------------------------

export type SchedulerName = 'FCFS' | 'ROUND_ROBIN' | 'SJF' | 'EDF' | 'MIN_MIN' | 'IPSO' | 'IACO' | 'HH';

export function createScheduler(name: SchedulerName): SchedulerPlugin {
  switch (name) {
    case 'FCFS': return new FCFSScheduler();
    case 'ROUND_ROBIN': return new RoundRobinScheduler();
    case 'SJF': return new SJFScheduler();
    case 'EDF': return new EDFScheduler();
    case 'MIN_MIN': return new MinMinScheduler();
    case 'IPSO': return new IPSOScheduler();
    case 'IACO': return new IACOScheduler();
    case 'HH': return new HybridHeuristicScheduler();
    default:
      throw new Error(`Unknown scheduler: ${name}`);
  }
}

export const ALL_SCHEDULER_NAMES: SchedulerName[] = [
  'FCFS', 'ROUND_ROBIN', 'SJF', 'EDF', 'MIN_MIN', 'IPSO', 'IACO', 'HH',
];
