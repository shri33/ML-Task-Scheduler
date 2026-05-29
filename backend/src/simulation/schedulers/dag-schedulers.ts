/**
 * DAG Scheduling Algorithms
 * =========================
 * Implements scheduling for Directed Acyclic Graph (DAG) workflows:
 *
 *   HEFT — Heterogeneous Earliest Finish Time (Topcuoglu et al., 2002)
 *   CPOP — Critical Path on a Processor (Topcuoglu et al., 2002)
 *   PEFT — Predict Earliest Finish Time (Arabnejad & Barbosa, 2014)
 *
 * These are the standard algorithms for scheduling task DAGs onto
 * heterogeneous processors — the canonical benchmark algorithms in
 * fog/edge/grid scheduling research.
 */

import { SimTask, SimNode, SchedulingDecision } from '../types';

// ---------------------------------------------------------------------------
// DAG Representation
// ---------------------------------------------------------------------------

export interface DAGEdge {
  fromTaskId: string;
  toTaskId: string;
  /** Communication cost in seconds (data transfer between nodes). */
  communicationCost: number;
}

export interface DAG {
  tasks: Map<string, SimTask>;
  /** Adjacency list: parent → children. */
  children: Map<string, string[]>;
  /** Reverse adjacency: child → parents. */
  parents: Map<string, string[]>;
  /** Communication costs between task pairs. */
  commCosts: Map<string, number>;
  /** Entry tasks (no parents). */
  entryTasks: string[];
  /** Exit tasks (no children). */
  exitTasks: string[];
}

/**
 * Build a DAG structure from tasks using their dependency arrays.
 * Communication cost is estimated from data sizes.
 */
export function buildDAG(
  tasks: SimTask[],
  commCostFn: (from: SimTask, to: SimTask) => number,
): DAG {
  const taskMap = new Map<string, SimTask>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const commCosts = new Map<string, number>();

  for (const task of tasks) {
    taskMap.set(task.id, task);
    children.set(task.id, []);
    parents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (taskMap.has(depId)) {
        children.get(depId)!.push(task.id);
        parents.get(task.id)!.push(depId);
        const key = `${depId}->${task.id}`;
        commCosts.set(key, commCostFn(taskMap.get(depId)!, task));
      }
    }
  }

  const entryTasks = tasks.filter((t) => parents.get(t.id)!.length === 0).map((t) => t.id);
  const exitTasks = tasks.filter((t) => children.get(t.id)!.length === 0).map((t) => t.id);

  return { tasks: taskMap, children, parents, commCosts, entryTasks, exitTasks };
}

// ---------------------------------------------------------------------------
// Computation Cost Matrix
// ---------------------------------------------------------------------------

/**
 * Build the W matrix: W[i][j] = execution time of task i on processor j.
 * Uses estimated exec time scaled by processor speed relative to mean.
 */
function buildCompCostMatrix(
  dag: DAG,
  nodes: SimNode[],
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  const meanSpeed = nodes.reduce((sum, n) => sum + n.capacity.cpuFreqGHz * n.capacity.cpuCores, 0) / nodes.length;

  for (const [taskId, task] of dag.tasks) {
    const row = new Map<string, number>();
    for (const node of nodes) {
      const nodeSpeed = node.capacity.cpuFreqGHz * Math.min(node.capacity.cpuCores, task.requirements.cpuCores);
      const speedRatio = meanSpeed / Math.max(0.01, nodeSpeed);
      row.set(node.id, task.estimatedExecTime * speedRatio);
    }
    matrix.set(taskId, row);
  }
  return matrix;
}

/** Average computation cost of a task across all processors. */
function avgCompCost(taskId: string, compCosts: Map<string, Map<string, number>>): number {
  const costs = compCosts.get(taskId)!;
  let sum = 0;
  let count = 0;
  for (const cost of costs.values()) {
    sum += cost;
    count++;
  }
  return sum / Math.max(1, count);
}

// ---------------------------------------------------------------------------
// HEFT Algorithm
// ---------------------------------------------------------------------------

/**
 * HEFT: Heterogeneous Earliest Finish Time
 *
 * Phase 1: Compute upward rank of each task (bottom-up traversal).
 * Phase 2: Sort tasks by decreasing upward rank.
 * Phase 3: For each task, assign to the processor that gives earliest finish time.
 *
 * Reference: Topcuoglu, Hariri, Wu — "Performance-Effective and Low-Complexity
 *            Task Scheduling for Heterogeneous Computing" (IEEE TPDS, 2002)
 */
export function scheduleHEFT(
  dag: DAG,
  nodes: SimNode[],
  getCommCost: (fromTaskId: string, toTaskId: string, fromNode: string, toNode: string) => number,
): SchedulingDecision[] {
  const compCosts = buildCompCostMatrix(dag, nodes);

  // Phase 1: Compute upward rank (recursive, memoized)
  const upwardRank = new Map<string, number>();

  function computeUpwardRank(taskId: string): number {
    if (upwardRank.has(taskId)) return upwardRank.get(taskId)!;

    const successors = dag.children.get(taskId) || [];
    const avgComp = avgCompCost(taskId, compCosts);

    if (successors.length === 0) {
      upwardRank.set(taskId, avgComp);
      return avgComp;
    }

    let maxSuccRank = 0;
    for (const succId of successors) {
      const commKey = `${taskId}->${succId}`;
      const avgComm = dag.commCosts.get(commKey) || 0;
      const succRank = computeUpwardRank(succId);
      maxSuccRank = Math.max(maxSuccRank, avgComm + succRank);
    }

    const rank = avgComp + maxSuccRank;
    upwardRank.set(taskId, rank);
    return rank;
  }

  for (const taskId of dag.tasks.keys()) {
    computeUpwardRank(taskId);
  }

  // Phase 2: Sort by decreasing upward rank
  const sortedTasks = Array.from(dag.tasks.keys()).sort(
    (a, b) => upwardRank.get(b)! - upwardRank.get(a)!,
  );

  // Phase 3: Assign each task to the processor that minimizes EFT
  const nodeAvailTime = new Map<string, number>();
  for (const node of nodes) {
    nodeAvailTime.set(node.id, 0);
  }

  const taskFinishTime = new Map<string, number>();
  const taskAssignment = new Map<string, string>();
  const decisions: SchedulingDecision[] = [];

  for (const taskId of sortedTasks) {
    let bestNode = '';
    let bestEFT = Infinity;
    let bestEST = 0;

    for (const node of nodes) {
      // EST = max(node available, max(predecessor finish + comm cost))
      let est = nodeAvailTime.get(node.id) || 0;

      const preds = dag.parents.get(taskId) || [];
      for (const predId of preds) {
        const predFinish = taskFinishTime.get(predId) || 0;
        const predNode = taskAssignment.get(predId) || '';
        const comm = predNode === node.id ? 0 : getCommCost(predId, taskId, predNode, node.id);
        est = Math.max(est, predFinish + comm);
      }

      const execTime = compCosts.get(taskId)!.get(node.id) || 0;
      const eft = est + execTime;

      if (eft < bestEFT) {
        bestEFT = eft;
        bestEST = est;
        bestNode = node.id;
      }
    }

    taskFinishTime.set(taskId, bestEFT);
    taskAssignment.set(taskId, bestNode);
    nodeAvailTime.set(bestNode, bestEFT);

    const execTime = compCosts.get(taskId)!.get(bestNode) || 0;
    decisions.push({
      taskId,
      targetNodeId: bestNode,
      algorithm: 'HEFT',
      predictedExecTime: execTime,
      predictedTransferTime: bestEST - (nodeAvailTime.get(bestNode) || 0),
      predictedQueueWait: 0,
      predictedTotal: bestEFT,
      score: upwardRank.get(taskId) || 0,
      reason: `Upward rank: ${upwardRank.get(taskId)?.toFixed(2)}, EFT: ${bestEFT.toFixed(2)}`,
      decisionTime: 0,
    });
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// CPOP Algorithm
// ---------------------------------------------------------------------------

/**
 * CPOP: Critical Path on a Processor
 *
 * Phase 1: Compute upward AND downward ranks.
 * Phase 2: Identify critical path (tasks where rank_up + rank_down = max).
 * Phase 3: Assign critical path tasks to the processor that minimizes
 *          total critical path length. Non-critical tasks use HEFT logic.
 *
 * Reference: Topcuoglu, Hariri, Wu (2002) — same paper as HEFT.
 */
export function scheduleCPOP(
  dag: DAG,
  nodes: SimNode[],
  getCommCost: (fromTaskId: string, toTaskId: string, fromNode: string, toNode: string) => number,
): SchedulingDecision[] {
  const compCosts = buildCompCostMatrix(dag, nodes);

  // Compute upward rank
  const upwardRank = new Map<string, number>();
  function computeUpward(taskId: string): number {
    if (upwardRank.has(taskId)) return upwardRank.get(taskId)!;
    const successors = dag.children.get(taskId) || [];
    const avgComp = avgCompCost(taskId, compCosts);
    if (successors.length === 0) {
      upwardRank.set(taskId, avgComp);
      return avgComp;
    }
    let maxSucc = 0;
    for (const succId of successors) {
      const comm = dag.commCosts.get(`${taskId}->${succId}`) || 0;
      maxSucc = Math.max(maxSucc, comm + computeUpward(succId));
    }
    const rank = avgComp + maxSucc;
    upwardRank.set(taskId, rank);
    return rank;
  }

  // Compute downward rank
  const downwardRank = new Map<string, number>();
  function computeDownward(taskId: string): number {
    if (downwardRank.has(taskId)) return downwardRank.get(taskId)!;
    const predecessors = dag.parents.get(taskId) || [];
    if (predecessors.length === 0) {
      downwardRank.set(taskId, 0);
      return 0;
    }
    let maxPred = 0;
    for (const predId of predecessors) {
      const comm = dag.commCosts.get(`${predId}->${taskId}`) || 0;
      const predComp = avgCompCost(predId, compCosts);
      maxPred = Math.max(maxPred, computeDownward(predId) + predComp + comm);
    }
    downwardRank.set(taskId, maxPred);
    return maxPred;
  }

  for (const taskId of dag.tasks.keys()) {
    computeUpward(taskId);
  }

  // Topological order for downward rank
  const topoOrder = topologicalSort(dag);
  for (const taskId of topoOrder) {
    computeDownward(taskId);
  }

  // Identify critical path
  const priorityValue = new Map<string, number>();
  let maxPriority = 0;
  for (const taskId of dag.tasks.keys()) {
    const pv = upwardRank.get(taskId)! + downwardRank.get(taskId)!;
    priorityValue.set(taskId, pv);
    maxPriority = Math.max(maxPriority, pv);
  }

  const criticalThreshold = maxPriority * 0.999;
  const criticalTasks = new Set<string>();
  for (const [taskId, pv] of priorityValue) {
    if (pv >= criticalThreshold) criticalTasks.add(taskId);
  }

  // Find best processor for critical path (minimize sum of critical task execution times)
  let bestCriticalNode = nodes[0].id;
  let bestCriticalCost = Infinity;
  for (const node of nodes) {
    let totalCost = 0;
    for (const taskId of criticalTasks) {
      totalCost += compCosts.get(taskId)!.get(node.id) || 0;
    }
    if (totalCost < bestCriticalCost) {
      bestCriticalCost = totalCost;
      bestCriticalNode = node.id;
    }
  }

  // Schedule: sort by priority value descending
  const sortedTasks = Array.from(dag.tasks.keys()).sort(
    (a, b) => priorityValue.get(b)! - priorityValue.get(a)!,
  );

  const nodeAvailTime = new Map<string, number>();
  for (const node of nodes) nodeAvailTime.set(node.id, 0);

  const taskFinishTime = new Map<string, number>();
  const taskAssignment = new Map<string, string>();
  const decisions: SchedulingDecision[] = [];

  for (const taskId of sortedTasks) {
    if (criticalTasks.has(taskId)) {
      // Assign critical tasks to the best critical processor
      let est = nodeAvailTime.get(bestCriticalNode) || 0;
      for (const predId of dag.parents.get(taskId) || []) {
        const predFinish = taskFinishTime.get(predId) || 0;
        const predNode = taskAssignment.get(predId) || '';
        const comm = predNode === bestCriticalNode ? 0 : getCommCost(predId, taskId, predNode, bestCriticalNode);
        est = Math.max(est, predFinish + comm);
      }
      const execTime = compCosts.get(taskId)!.get(bestCriticalNode) || 0;
      const eft = est + execTime;

      taskFinishTime.set(taskId, eft);
      taskAssignment.set(taskId, bestCriticalNode);
      nodeAvailTime.set(bestCriticalNode, eft);

      decisions.push({
        taskId,
        targetNodeId: bestCriticalNode,
        algorithm: 'CPOP',
        predictedExecTime: execTime,
        predictedTransferTime: 0,
        predictedQueueWait: 0,
        predictedTotal: eft,
        score: priorityValue.get(taskId) || 0,
        reason: `Critical path task, priority: ${priorityValue.get(taskId)?.toFixed(2)}`,
        decisionTime: 0,
      });
    } else {
      // Non-critical tasks: HEFT-style EFT minimization
      let bestNode = '';
      let bestEFT = Infinity;

      for (const node of nodes) {
        let est = nodeAvailTime.get(node.id) || 0;
        for (const predId of dag.parents.get(taskId) || []) {
          const predFinish = taskFinishTime.get(predId) || 0;
          const predNode = taskAssignment.get(predId) || '';
          const comm = predNode === node.id ? 0 : getCommCost(predId, taskId, predNode, node.id);
          est = Math.max(est, predFinish + comm);
        }
        const execTime = compCosts.get(taskId)!.get(node.id) || 0;
        const eft = est + execTime;
        if (eft < bestEFT) {
          bestEFT = eft;
          bestNode = node.id;
        }
      }

      const execTime = compCosts.get(taskId)!.get(bestNode) || 0;
      taskFinishTime.set(taskId, bestEFT);
      taskAssignment.set(taskId, bestNode);
      nodeAvailTime.set(bestNode, bestEFT);

      decisions.push({
        taskId,
        targetNodeId: bestNode,
        algorithm: 'CPOP',
        predictedExecTime: execTime,
        predictedTransferTime: 0,
        predictedQueueWait: 0,
        predictedTotal: bestEFT,
        score: priorityValue.get(taskId) || 0,
        reason: `Non-critical, EFT: ${bestEFT.toFixed(2)}`,
        decisionTime: 0,
      });
    }
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// PEFT Algorithm
// ---------------------------------------------------------------------------

/**
 * PEFT: Predict Earliest Finish Time
 *
 * Uses an Optimistic Cost Table (OCT) instead of upward rank.
 * OCT[t][p] = max over successors s of min over processor q of
 *   (comm(t,p,s,q) + comp(s,q) + OCT[s][q])
 *
 * Reference: Arabnejad & Barbosa — "List Scheduling Algorithm for
 *            Heterogeneous Systems by an Optimistic Cost Table" (IEEE TPDS, 2014)
 */
export function schedulePEFT(
  dag: DAG,
  nodes: SimNode[],
  getCommCost: (fromTaskId: string, toTaskId: string, fromNode: string, toNode: string) => number,
): SchedulingDecision[] {
  const compCosts = buildCompCostMatrix(dag, nodes);

  // Compute OCT (bottom-up)
  const oct = new Map<string, Map<string, number>>();
  const reverseOrder = topologicalSort(dag).reverse();

  for (const taskId of reverseOrder) {
    const row = new Map<string, number>();
    const successors = dag.children.get(taskId) || [];

    for (const node of nodes) {
      if (successors.length === 0) {
        row.set(node.id, 0);
        continue;
      }

      let maxSuccCost = 0;
      for (const succId of successors) {
        let minOverProc = Infinity;
        for (const succNode of nodes) {
          const comm = node.id === succNode.id ? 0 : getCommCost(taskId, succId, node.id, succNode.id);
          const succComp = compCosts.get(succId)!.get(succNode.id) || 0;
          const succOct = oct.get(succId)?.get(succNode.id) || 0;
          minOverProc = Math.min(minOverProc, comm + succComp + succOct);
        }
        maxSuccCost = Math.max(maxSuccCost, minOverProc);
      }
      row.set(node.id, maxSuccCost);
    }
    oct.set(taskId, row);
  }

  // Rank = average OCT across processors + average computation cost
  const rank = new Map<string, number>();
  for (const taskId of dag.tasks.keys()) {
    const octRow = oct.get(taskId)!;
    let octSum = 0;
    let count = 0;
    for (const val of octRow.values()) {
      octSum += val;
      count++;
    }
    rank.set(taskId, avgCompCost(taskId, compCosts) + octSum / Math.max(1, count));
  }

  // Sort by decreasing rank
  const sortedTasks = Array.from(dag.tasks.keys()).sort(
    (a, b) => rank.get(b)! - rank.get(a)!,
  );

  // Assign using OEFT = EFT + OCT[task][processor]
  const nodeAvailTime = new Map<string, number>();
  for (const node of nodes) nodeAvailTime.set(node.id, 0);

  const taskFinishTime = new Map<string, number>();
  const taskAssignment = new Map<string, string>();
  const decisions: SchedulingDecision[] = [];

  for (const taskId of sortedTasks) {
    let bestNode = '';
    let bestOEFT = Infinity;
    let bestEFT = Infinity;

    for (const node of nodes) {
      let est = nodeAvailTime.get(node.id) || 0;
      for (const predId of dag.parents.get(taskId) || []) {
        const predFinish = taskFinishTime.get(predId) || 0;
        const predNode = taskAssignment.get(predId) || '';
        const comm = predNode === node.id ? 0 : getCommCost(predId, taskId, predNode, node.id);
        est = Math.max(est, predFinish + comm);
      }
      const execTime = compCosts.get(taskId)!.get(node.id) || 0;
      const eft = est + execTime;
      const oeft = eft + (oct.get(taskId)?.get(node.id) || 0);

      if (oeft < bestOEFT) {
        bestOEFT = oeft;
        bestEFT = eft;
        bestNode = node.id;
      }
    }

    const execTime = compCosts.get(taskId)!.get(bestNode) || 0;
    taskFinishTime.set(taskId, bestEFT);
    taskAssignment.set(taskId, bestNode);
    nodeAvailTime.set(bestNode, bestEFT);

    decisions.push({
      taskId,
      targetNodeId: bestNode,
      algorithm: 'PEFT',
      predictedExecTime: execTime,
      predictedTransferTime: 0,
      predictedQueueWait: 0,
      predictedTotal: bestEFT,
      score: rank.get(taskId) || 0,
      reason: `OEFT: ${bestOEFT.toFixed(2)}, EFT: ${bestEFT.toFixed(2)}`,
      decisionTime: 0,
    });
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// Topological Sort
// ---------------------------------------------------------------------------

function topologicalSort(dag: DAG): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(taskId: string): void {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    for (const predId of dag.parents.get(taskId) || []) {
      dfs(predId);
    }
    result.push(taskId);
  }

  for (const taskId of dag.tasks.keys()) {
    dfs(taskId);
  }

  return result;
}
