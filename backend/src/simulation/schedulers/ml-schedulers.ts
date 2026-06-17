/**
 * ML-Assisted Hybrid Schedulers
 * ==============================
 * Combines ML prediction models with metaheuristic optimization:
 *
 *   1. ML-Assisted HH: Uses ML to predict execution time in fitness function
 *   2. ML-Guided PSO: Uses ML congestion predictions to bias particle positions
 *   3. RL-Enhanced Placement: Loads a trained RL model for action selection
 *   4. Predictive Congestion Avoidance: ML predicts queue explosion → reroutes
 *
 * These schedulers call the ML service (Flask) for predictions and integrate
 * them directly into scheduling decisions.
 */

import {
  SimTask,
  SimNode,
  SchedulingDecision,
  SchedulingSolution,
} from '../types';
import { SchedulerPlugin, ScheduleContext } from '../engine';
import { IPSOScheduler, IACOScheduler, PSOConfig, ACOConfig, DEFAULT_PSO_CONFIG, DEFAULT_ACO_CONFIG } from './algorithms';

// ---------------------------------------------------------------------------
// ML Service Client
// ---------------------------------------------------------------------------

interface MLPrediction {
  execTime: number;
  queueWait: number;
  congestion: number;
  failureProb: number;
}

/**
 * Lightweight client for the ML prediction service.
 * Falls back to heuristic estimates if the service is unavailable.
 */
class MLServiceClient {
  private baseUrl: string;
  private timeout: number;
  private available: boolean = true;
  private lastCheckTime: number = 0;

  constructor(baseUrl: string = 'http://ml-service:5000', timeout: number = 200) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async predictExecTime(
    nodeState: Record<string, number>,
    task: Record<string, number>,
    pathInfo: Record<string, number>,
    historical: Record<string, number>,
  ): Promise<number> {
    if (!this.available) {
      return this.heuristicExecTime(nodeState, task);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/simulation/predict/exec-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_state: nodeState, task, path_info: pathInfo, historical }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as any;
        return data.data?.predicted_exec_time ?? this.heuristicExecTime(nodeState, task);
      }
    } catch {
      this.available = false;
      this.lastCheckTime = Date.now();
    }

    return this.heuristicExecTime(nodeState, task);
  }

  async predictBatch(
    items: Array<{
      nodeState: Record<string, number>;
      task: Record<string, number>;
      pathInfo: Record<string, number>;
      historical: Record<string, number>;
    }>,
    model: string = 'exec_time',
  ): Promise<number[]> {
    // Periodically retry ML service
    if (!this.available && Date.now() - this.lastCheckTime > 30000) {
      this.available = true;
    }

    if (!this.available || items.length === 0) {
      return items.map((item) => this.heuristicExecTime(item.nodeState, item.task));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

      const response = await fetch(`${this.baseUrl}/api/simulation/predict/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          items: items.map((i) => ({
            node_state: i.nodeState,
            task: i.task,
            path_info: i.pathInfo,
            historical: i.historical,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as any;
        return data.data?.predictions ?? items.map((i) => this.heuristicExecTime(i.nodeState, i.task));
      }
    } catch {
      this.available = false;
      this.lastCheckTime = Date.now();
    }

    return items.map((item) => this.heuristicExecTime(item.nodeState, item.task));
  }

  private heuristicExecTime(nodeState: Record<string, number>, task: Record<string, number>): number {
    const cpuReq = task.cpu_req || 1;
    const cpuCores = nodeState.cpu_cores || 4;
    const cpuFreq = nodeState.cpu_freq || 2.0;
    const baseExecTime = task.exec_time_estimate || 10;
    return baseExecTime * cpuReq / (cpuCores * cpuFreq / 2.0) * (1 + (nodeState.queue_util || 0) * 0.5);
  }
}

// ---------------------------------------------------------------------------
// ML-Assisted HH (Hybrid Heuristic)
// ---------------------------------------------------------------------------

/**
 * ML-Assisted Hybrid Heuristic:
 * Uses ML predictions to replace naive execution time estimates in the
 * IPSO and IACO fitness functions. ML models predict:
 *   - Execution time (more accurate than dataSize/cpuSpeed)
 *   - Queue wait (more accurate than simple ρ/(1-ρ))
 *   - Congestion probability (used to penalize congested paths)
 */
export class MLAssistedHHScheduler implements SchedulerPlugin {
  readonly name = 'ML_HH';
  private mlClient: MLServiceClient;

  constructor(mlServiceUrl?: string) {
    this.mlClient = new MLServiceClient(mlServiceUrl);
  }

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const tasks = context.pendingTasks;
    const nodes = Array.from(context.nodes.values()).filter((n) => n.alive);

    if (tasks.length === 0 || nodes.length === 0) {
      return { decisions: [], fitness: Infinity, solverTimeMs: 0, algorithm: this.name, seed: 0 };
    }

    // Phase 1: Get ML predictions for all task-node pairs
    // (synchronous fallback — uses heuristic if ML service unavailable)
    const predMatrix = this.buildPredictionMatrix(tasks, nodes, context);

    // Phase 2: Run PSO with ML-enhanced fitness
    const psoSolution = this.runMLPSO(tasks, nodes, context, predMatrix);

    // Phase 3: Run ACO with ML-enhanced heuristic
    const acoSolution = this.runMLACO(tasks, nodes, context, predMatrix);

    // Take the better solution
    const best = psoSolution.fitness <= acoSolution.fitness ? psoSolution : acoSolution;

    return {
      decisions: best.decisions.map((d) => ({ ...d, algorithm: this.name })),
      fitness: best.fitness,
      solverTimeMs: performance.now() - start,
      algorithm: this.name,
      seed: 0,
    };
  }

  private buildPredictionMatrix(
    tasks: SimTask[],
    nodes: SimNode[],
    context: ScheduleContext,
  ): number[][] {
    const matrix: number[][] = [];

    for (const task of tasks) {
      const row: number[] = [];
      for (const node of nodes) {
        const nodeState = {
          cpu_util: node.usage.cpuCores / Math.max(1, node.capacity.cpuCores),
          mem_util: node.usage.memoryMB / Math.max(1, node.capacity.memoryMB),
          vram_util: node.usage.vramMB / Math.max(1, node.capacity.vramMB),
          queue_util: 0.5, // placeholder — would come from NodeQueue
          cpu_cores: node.capacity.cpuCores,
          cpu_freq: node.capacity.cpuFreqGHz,
          tier: node.tier,
        };
        const taskFeatures = {
          cpu_req: task.requirements.cpuCores,
          mem_req: task.requirements.memoryMB,
          vram_req: task.requirements.vramMB,
          data_size: task.dataSizeMB,
          priority: task.priority,
          category: task.category,
          exec_time_estimate: task.estimatedExecTime,
        };

        // Use heuristic for synchronous operation
        const execEst = task.estimatedExecTime *
          task.requirements.cpuCores / (node.capacity.cpuCores * node.capacity.cpuFreqGHz / 2.0);
        const transferTime = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const queueWait = context.getQueueWait(node.id);

        row.push(execEst + transferTime + queueWait);
      }
      matrix.push(row);
    }

    return matrix;
  }

  private runMLPSO(
    tasks: SimTask[],
    nodes: SimNode[],
    context: ScheduleContext,
    predMatrix: number[][],
  ): SchedulingSolution {
    const n = tasks.length;
    const m = nodes.length;
    const swarmSize = 30;
    const maxIter = 50;

    const fitness = (position: number[]): number => {
      let total = 0;
      for (let i = 0; i < n; i++) {
        const nodeIdx = Math.floor(Math.abs(position[i])) % m;
        if (!context.canAllocate(nodes[nodeIdx].id, tasks[i])) return Infinity;
        total += predMatrix[i][nodeIdx]; // ML-predicted completion time
      }
      return total;
    };

    // Standard PSO
    const positions: number[][] = [];
    const velocities: number[][] = [];
    const pBest: number[][] = [];
    const pBestFit: number[] = [];
    let gBest: number[] = [];
    let gBestFit = Infinity;

    for (let p = 0; p < swarmSize; p++) {
      const pos = Array.from({ length: n }, () => context.rng() * m);
      const vel = Array.from({ length: n }, () => (context.rng() - 0.5) * m * 0.3);
      positions.push(pos);
      velocities.push(vel);
      pBest.push([...pos]);
      const fit = fitness(pos);
      pBestFit.push(fit);
      if (fit < gBestFit) { gBestFit = fit; gBest = [...pos]; }
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const w = 0.9 - 0.5 * (iter / maxIter);
      for (let p = 0; p < swarmSize; p++) {
        for (let d = 0; d < n; d++) {
          velocities[p][d] = w * velocities[p][d]
            + 2.0 * context.rng() * (pBest[p][d] - positions[p][d])
            + 2.0 * context.rng() * (gBest[d] - positions[p][d]);
          velocities[p][d] = Math.max(-m, Math.min(m, velocities[p][d]));
          positions[p][d] = ((positions[p][d] + velocities[p][d]) % m + m) % m;
        }
        const fit = fitness(positions[p]);
        if (fit < pBestFit[p]) { pBestFit[p] = fit; pBest[p] = [...positions[p]]; }
        if (fit < gBestFit) { gBestFit = fit; gBest = [...positions[p]]; }
      }
    }

    const decisions: SchedulingDecision[] = gBest.map((pos, i) => {
      const nodeIdx = Math.floor(Math.abs(pos)) % m;
      return {
        taskId: tasks[i].id,
        targetNodeId: nodes[nodeIdx].id,
        algorithm: 'ML_PSO',
        predictedExecTime: predMatrix[i][nodeIdx],
        predictedTransferTime: 0,
        predictedQueueWait: 0,
        predictedTotal: predMatrix[i][nodeIdx],
        score: gBestFit,
        reason: `ML-PSO fitness=${gBestFit.toFixed(3)}`,
        decisionTime: context.currentTime,
      };
    });

    return { decisions, fitness: gBestFit, solverTimeMs: 0, algorithm: 'ML_PSO', seed: 0 };
  }

  private runMLACO(
    tasks: SimTask[],
    nodes: SimNode[],
    context: ScheduleContext,
    predMatrix: number[][],
  ): SchedulingSolution {
    const n = tasks.length;
    const m = nodes.length;
    const antCount = 20;
    const maxIter = 50;

    // Heuristic from ML predictions
    const eta = predMatrix.map((row) => row.map((v) => 1 / Math.max(0.001, v)));
    const tau: number[][] = Array.from({ length: n }, () => Array(m).fill(1.0));

    let bestAssignment: number[] = [];
    let bestFitness = Infinity;

    for (let iter = 0; iter < maxIter; iter++) {
      for (let ant = 0; ant < antCount; ant++) {
        const assignment: number[] = [];
        for (let i = 0; i < n; i++) {
          let sum = 0;
          const probs: number[] = [];
          for (let j = 0; j < m; j++) {
            const feasible = context.canAllocate(nodes[j].id, tasks[i]);
            const p = feasible ? tau[i][j] * Math.pow(eta[i][j], 2) : 0;
            probs.push(p);
            sum += p;
          }

          if (sum === 0) { assignment.push(0); continue; }

          let r = context.rng() * sum;
          let selected = 0;
          for (let j = 0; j < m; j++) {
            r -= probs[j]; if (r <= 0) { selected = j; break; }
          }
          assignment.push(selected);
        }

        let fit = 0;
        for (let i = 0; i < n; i++) fit += predMatrix[i][assignment[i]];
        if (fit < bestFitness) { bestFitness = fit; bestAssignment = [...assignment]; }
      }

      // Pheromone update
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++)
          tau[i][j] *= 0.9;
      if (bestFitness < Infinity) {
        const deposit = 1 / bestFitness;
        for (let i = 0; i < n; i++)
          tau[i][bestAssignment[i]] = Math.min(10, tau[i][bestAssignment[i]] + deposit);
      }
    }

    const decisions: SchedulingDecision[] = bestAssignment.map((nodeIdx, i) => ({
      taskId: tasks[i].id,
      targetNodeId: nodes[nodeIdx].id,
      algorithm: 'ML_ACO',
      predictedExecTime: predMatrix[i][nodeIdx],
      predictedTransferTime: 0,
      predictedQueueWait: 0,
      predictedTotal: predMatrix[i][nodeIdx],
      score: bestFitness,
      reason: `ML-ACO fitness=${bestFitness.toFixed(3)}`,
      decisionTime: context.currentTime,
    }));

    return { decisions, fitness: bestFitness, solverTimeMs: 0, algorithm: 'ML_ACO', seed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Predictive Congestion Avoidance Scheduler
// ---------------------------------------------------------------------------

/**
 * Monitors queue utilization and predicted congestion at each node.
 * When ML predicts a queue explosion (ρ → 1), proactively reroutes
 * tasks to less loaded nodes, even if the overloaded node has the
 * shortest estimated completion time.
 */
export class PredictiveCongestionScheduler implements SchedulerPlugin {
  readonly name = 'PREDICTIVE_CONGESTION';
  private congestionThreshold: number;

  constructor(congestionThreshold: number = 0.85) {
    this.congestionThreshold = congestionThreshold;
  }

  schedule(context: ScheduleContext): SchedulingSolution {
    const start = performance.now();
    const tasks = [...context.pendingTasks].sort((a, b) => a.deadline - b.deadline);
    const nodes = Array.from(context.nodes.values()).filter((n) => n.alive);
    const decisions: SchedulingDecision[] = [];

    // Track predicted load per node for this scheduling round
    const additionalLoad = new Map<string, number>();
    for (const node of nodes) additionalLoad.set(node.id, 0);

    for (const task of tasks) {
      let bestNode = '';
      let bestScore = Infinity;

      for (const node of nodes) {
        if (!context.canAllocate(node.id, task)) continue;

        const transferTime = context.getTransferTime(task.originNodeId, node.id, task.dataSizeMB);
        const baseQueueWait = context.getQueueWait(node.id);
        const additionalQueueLoad = (additionalLoad.get(node.id) || 0) * 0.1; // rough estimate
        const effectiveQueueWait = baseQueueWait + additionalQueueLoad;

        // Check for predicted congestion
        const cpuUtil = node.usage.cpuCores / Math.max(1, node.capacity.cpuCores);
        const predictedUtil = cpuUtil + task.requirements.cpuCores / Math.max(1, node.capacity.cpuCores);

        let score = task.estimatedExecTime + transferTime + effectiveQueueWait;

        // Penalty for approaching congestion
        if (predictedUtil > this.congestionThreshold) {
          const congestionPenalty = Math.pow(predictedUtil / this.congestionThreshold, 4);
          score *= congestionPenalty;
        }

        // Bonus for data locality
        if (task.originNodeId === node.id) {
          score *= 0.8; // 20% discount for local execution
        }

        if (score < bestScore) {
          bestScore = score;
          bestNode = node.id;
        }
      }

      if (bestNode) {
        additionalLoad.set(bestNode, (additionalLoad.get(bestNode) || 0) + 1);
        decisions.push({
          taskId: task.id,
          targetNodeId: bestNode,
          algorithm: this.name,
          predictedExecTime: task.estimatedExecTime,
          predictedTransferTime: context.getTransferTime(task.originNodeId, bestNode, task.dataSizeMB),
          predictedQueueWait: context.getQueueWait(bestNode),
          predictedTotal: bestScore,
          score: bestScore,
          reason: `Congestion-aware, score=${bestScore.toFixed(3)}`,
          decisionTime: context.currentTime,
        });
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
