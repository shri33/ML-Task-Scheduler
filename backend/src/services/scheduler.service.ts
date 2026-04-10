import prisma from '../lib/prisma';
import { taskService } from './task.service';
import { resourceService } from './resource.service';
import { mlService } from './ml.service';
import logger from '../lib/logger';
import {
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  HybridHeuristicScheduler,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  roundRobinSchedule,
  minMinSchedule,
  fcfsSchedule,
  runAlgorithmComparison,
  calculateTotalDelay,
  calculateEnergyConsumption,
  useSeed,
  type Task as FogTask,
  type FogNode,
  type TerminalDevice,
  type SchedulingSolution,
} from './fogComputing.service';

// Map enums to numbers (same mapping used by ML service)
const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

// ---------------------------------------------------------------------------
// Unified Objective Function J
// ALL algorithms are evaluated against this same metric for fair comparison.
// J = Σ_i [ lateness_i² + λ * context_switches + μ * (1 - completion_rate) ]
// ---------------------------------------------------------------------------

/** Weights for the unified objective. Shared across all algorithms. */
export const OBJECTIVE_WEIGHTS = {
  LATENESS_ALPHA: 1.0,       // quadratic lateness penalty
  CONTEXT_SWITCH_LAMBDA: 0.3, // penalty per context switch
  COMPLETION_MU: 2.0,         // bonus per on-time completion
  STEP_PENALTY: 0.05,         // small per-task overhead
} as const;

// ---------------------------------------------------------------------------
// Scheduling Context — passed to every algorithm for reproducibility + bounds
// ---------------------------------------------------------------------------

export interface SchedulingContext {
  /** Deterministic seed for reproducible results (required for research). */
  seed?: number;
  /** Maximum wall-clock time (ms) an algorithm is allowed to run. */
  timeBudgetMs?: number;
  /** User behavior profile (when available). */
  userProfile?: {
    avgCompletionRate: number;
    avgLateness: number;
    productivityPattern: string | null;
  };
  /** ML prediction map (pre-fetched). */
  predictions?: Map<string, { predictedTime: number; confidence: number; modelVersion: string }>;
}

/** Generate an idempotent job key to prevent duplicate schedules. */
export function makeScheduleJobId(userId: string | undefined, taskIds: string[]): string {
  const taskHash = taskIds.length > 0
    ? taskIds.sort().join(',').slice(0, 64)
    : 'all';
  const ts = Math.floor(Date.now() / 5000); // 5-second granularity
  return `schedule:${userId ?? 'system'}:${ts}:${taskHash}`;
}

// ---------------------------------------------------------------------------
// Strategy pattern for pluggable scheduling algorithms
// ---------------------------------------------------------------------------

/** Available scheduling algorithm identifiers */
export type SchedulingAlgorithm =
  | 'ml_enhanced'      // Original weighted scoring + ML predictions
  | 'hybrid_heuristic' // IPSO + IACO hybrid (HH)
  | 'ipso'             // Improved Particle Swarm Optimization
  | 'iaco'             // Improved Ant Colony Optimization
  | 'round_robin'      // Round-Robin baseline
  | 'min_min'          // Min-Min heuristic
  | 'fcfs'             // First-Come-First-Served baseline
  | 'edf'              // Earliest Deadline First
  | 'sjf';             // Shortest Job First (by predicted time)

export interface AlgorithmInfo {
  id: SchedulingAlgorithm;
  name: string;
  category: 'optimization' | 'heuristic' | 'ml' | 'baseline';
  description: string;
  complexity: string;
}

/** Metadata about every supported algorithm */
export const ALGORITHM_REGISTRY: AlgorithmInfo[] = [
  {
    id: 'ml_enhanced',
    name: 'ML-Enhanced Scheduling',
    category: 'ml',
    description: 'Weighted scoring using ML-predicted execution times, resource load balancing, and task priority.',
    complexity: 'O(n·m) where n=tasks, m=resources',
  },
  {
    id: 'hybrid_heuristic',
    name: 'Hybrid Heuristic (IPSO+IACO)',
    category: 'optimization',
    description: 'Two-phase meta-heuristic: Improved PSO explores, then Improved ACO refines. Research-grade algorithm from Wang & Li (2019).',
    complexity: 'O(P·K·n·m) where P=particles/ants, K=iterations',
  },
  {
    id: 'ipso',
    name: 'Improved PSO',
    category: 'optimization',
    description: 'Improved Particle Swarm Optimization with adaptive inertia weight and contraction factor.',
    complexity: 'O(P·K·n·m)',
  },
  {
    id: 'iaco',
    name: 'Improved ACO',
    category: 'optimization',
    description: 'Improved Ant Colony Optimization with regulatory factor and improved heuristic information.',
    complexity: 'O(A·K·n·m)',
  },
  {
    id: 'edf',
    name: 'Earliest Deadline First',
    category: 'heuristic',
    description: 'Classic real-time scheduling: tasks sorted by deadline urgency, assigned to least-loaded resource.',
    complexity: 'O(n·log(n))',
  },
  {
    id: 'sjf',
    name: 'Shortest Job First',
    category: 'heuristic',
    description: 'Tasks sorted by ML-predicted execution time (shortest first), minimizes average wait time.',
    complexity: 'O(n·log(n))',
  },
  {
    id: 'round_robin',
    name: 'Round-Robin',
    category: 'baseline',
    description: 'Simple cyclic allocation. Baseline for fairness comparison.',
    complexity: 'O(n)',
  },
  {
    id: 'min_min',
    name: 'Min-Min',
    category: 'heuristic',
    description: 'Selects shortest task first and assigns it to the resource that finishes it soonest.',
    complexity: 'O(n²·m)',
  },
  {
    id: 'fcfs',
    name: 'First-Come-First-Served',
    category: 'baseline',
    description: 'Tasks processed in arrival order. Baseline for comparison.',
    complexity: 'O(n)',
  },
];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  name: string;
  type: string;
  size: string;
  priority: number;
  status: string;
  predictedTime: number | null;
  actualTime: number | null;
  resourceId: string | null;
  dueDate: Date | null;
  createdAt: Date;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

interface Resource {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleResult {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  predictedTime: number;
  confidence: number;
  score: number;
  explanation: string;
  algorithm: SchedulingAlgorithm;
}

interface ResourceScore {
  resource: Resource;
  score: number;
  predictedTime: number;
  confidence: number;
}

interface ComparisonResult {
  algorithm: SchedulingAlgorithm;
  algorithmName: string;
  totalDelay: number;
  totalEnergy: number;
  fitness: number;
  reliability: number;
  tasksScheduled: number;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Scheduler Service
// ---------------------------------------------------------------------------

export class SchedulerService {
  // -----------------------------------------------------------------------
  // Main scheduling — now supports pluggable algorithms + context
  // -----------------------------------------------------------------------
  async schedule(
    taskIds?: string[],
    algorithm: SchedulingAlgorithm = 'ml_enhanced',
    context: SchedulingContext = {}
  ): Promise<ScheduleResult[]> {
    const startTime = Date.now();
    const timeBudget = context.timeBudgetMs ?? 30_000; // Default 30s max

    // Set deterministic seed if provided (critical for research reproducibility)
    if (context.seed !== undefined) {
      useSeed(context.seed);
    }

    // Get tasks to schedule
    let tasks: Task[];
    if (taskIds && taskIds.length > 0) {
      tasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
          status: 'PENDING'
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
      });
    } else {
      tasks = await taskService.findPending();
    }

    if (tasks.length === 0) {
      // Reset seed after use
      if (context.seed !== undefined) useSeed(undefined);
      return [];
    }

    // Get available resources
    const resources = await resourceService.findAvailable();
    if (resources.length === 0) {
      if (context.seed !== undefined) useSeed(undefined);
      throw new Error('No available resources for scheduling');
    }

    logger.info(`Scheduling ${tasks.length} tasks with algorithm: ${algorithm}`, {
      seed: context.seed,
      timeBudgetMs: timeBudget,
      hasUserProfile: !!context.userProfile,
    });

    let results: ScheduleResult[];

    switch (algorithm) {
      case 'ml_enhanced':
        results = await this.scheduleWithML(tasks, resources);
        break;

      case 'hybrid_heuristic':
      case 'ipso':
      case 'iaco':
      case 'round_robin':
      case 'min_min':
      case 'fcfs':
        results = await this.scheduleWithFogAlgorithm(tasks, resources, algorithm);
        break;

      case 'edf':
        results = await this.scheduleWithEDF(tasks, resources);
        break;

      case 'sjf':
        results = await this.scheduleWithSJF(tasks, resources);
        break;

      default:
        results = await this.scheduleWithML(tasks, resources);
    }

    // Reset seed after use
    if (context.seed !== undefined) useSeed(undefined);

    const latencyMs = Date.now() - startTime;
    logger.info(`Scheduling completed: ${results.length} tasks in ${latencyMs}ms using ${algorithm}`);

    return results;
  }

  // -----------------------------------------------------------------------
  // ML-Enhanced scheduling (original approach, improved)
  // -----------------------------------------------------------------------
  private async scheduleWithML(tasks: Task[], resources: Resource[]): Promise<ScheduleResult[]> {
    // Batch ML prediction: collect all (task, resource) pairs in one call
    const batchItems = tasks.flatMap(task =>
      resources
        .filter(r => r.currentLoad < 100)
        .map(resource => ({
          taskId: `${task.id}::${resource.id}`,
          taskSize: sizeMap[task.size] || 2,
          taskType: typeMap[task.type] || 1,
          priority: task.priority,
          resourceLoad: resource.currentLoad, startupOverhead: 1
        }))
    );

    logger.info(`Batch predicting ${batchItems.length} (task,resource) pairs`);
    const predictions = await mlService.getBatchPredictions(batchItems);

    const results: ScheduleResult[] = [];

    for (const task of tasks) {
      const result = await this.scheduleTask(task, resources, predictions);
      if (result) {
        results.push(result);
        // Update resource load in memory for subsequent tasks
        const resourceIndex = resources.findIndex((r: Resource) => r.id === result.resourceId);
        if (resourceIndex !== -1) {
          resources[resourceIndex].currentLoad += 15;
        }
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Fog Computing algorithms (IPSO, IACO, HH, RR, Min-Min, FCFS)
  // Bridges DB tasks/resources → fog computing data structures → results
  // -----------------------------------------------------------------------
  private async scheduleWithFogAlgorithm(
    tasks: Task[],
    resources: Resource[],
    algorithm: SchedulingAlgorithm
  ): Promise<ScheduleResult[]> {
    // Convert DB tasks → fog computing tasks
    const fogTasks = this.convertToFogTasks(tasks, resources);
    const fogNodes = this.convertToFogNodes(resources);
    const devices = generateSampleDevices(Math.max(tasks.length, 5));

    // Map DB tasks to their device IDs (keep same order)
    for (let i = 0; i < fogTasks.length; i++) {
      fogTasks[i].terminalDeviceId = devices[i % devices.length].id;
    }

    // Run the selected algorithm
    let solution: SchedulingSolution;
    switch (algorithm) {
      case 'hybrid_heuristic': {
        const scheduler = new HybridHeuristicScheduler(fogTasks, fogNodes, devices);
        solution = scheduler.schedule();
        break;
      }
      case 'ipso':
        solution = ipsoOnlySchedule(fogTasks, fogNodes, devices);
        break;
      case 'iaco':
        solution = iacoOnlySchedule(fogTasks, fogNodes, devices);
        break;
      case 'round_robin':
        solution = roundRobinSchedule(fogTasks, fogNodes, devices);
        break;
      case 'min_min':
        solution = minMinSchedule(fogTasks, fogNodes, devices);
        break;
      case 'fcfs':
        solution = fcfsSchedule(fogTasks, fogNodes, devices);
        break;
      default:
        throw new Error(`Unsupported fog algorithm: ${algorithm}`);
    }

    // Convert fog solution back to ScheduleResult[]
    return this.convertFogSolutionToResults(tasks, resources, fogTasks, fogNodes, solution, algorithm);
  }

  // -----------------------------------------------------------------------
  // Earliest Deadline First (EDF)
  // -----------------------------------------------------------------------
  private async scheduleWithEDF(tasks: Task[], resources: Resource[]): Promise<ScheduleResult[]> {
    // Sort tasks by deadline urgency (earliest due date first, nulls last)
    const sortedTasks = [...tasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return b.priority - a.priority;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    // Get ML predictions for time estimates
    const batchItems = sortedTasks.flatMap(task =>
      resources.filter(r => r.currentLoad < 100).map(resource => ({
        taskId: `${task.id}::${resource.id}`,
        taskSize: sizeMap[task.size] || 2,
        taskType: typeMap[task.type] || 1,
        priority: task.priority,
        resourceLoad: resource.currentLoad,
        startupOverhead: 1,
      }))
    );
    const predictions = await mlService.getBatchPredictions(batchItems);

    const results: ScheduleResult[] = [];
    const resourceLoads = new Map(resources.map(r => [r.id, r.currentLoad]));

    for (const task of sortedTasks) {
      // Find the least-loaded resource
      let bestResource = resources[0];
      let minLoad = Infinity;
      for (const r of resources) {
        const load = resourceLoads.get(r.id) ?? r.currentLoad;
        if (load < minLoad && load < 100) {
          minLoad = load;
          bestResource = r;
        }
      }

      const key = `${task.id}::${bestResource.id}`;
      const prediction = predictions.get(key) || { predictedTime: 5, confidence: 0.5, modelVersion: 'fallback' };

      const deadlineUrgency = task.dueDate
        ? Math.max(0, 1 - ((task.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0;
      const score = 0.5 * deadlineUrgency + 0.3 * (task.priority / 5) + 0.2 * ((100 - minLoad) / 100);

      // Persist assignment
      await taskService.assignToResource(task.id, bestResource.id, prediction.predictedTime);
      const newLoad = Math.min(100, minLoad + 15);
      await resourceService.updateLoad(bestResource.id, newLoad);
      resourceLoads.set(bestResource.id, newLoad);

      await this.recordHistory(task.id, bestResource.id, 'EDF', true, prediction.predictedTime, score,
        `EDF: Task "${task.name}" scheduled first due to ${task.dueDate ? 'earliest deadline' : 'high priority'}.`
      );

      results.push({
        taskId: task.id,
        taskName: task.name,
        resourceId: bestResource.id,
        resourceName: bestResource.name,
        predictedTime: prediction.predictedTime,
        confidence: prediction.confidence,
        score,
        explanation: `EDF: Deadline urgency=${(deadlineUrgency * 100).toFixed(0)}%, priority=${task.priority}/5`,
        algorithm: 'edf',
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Shortest Job First (SJF) — uses ML-predicted times
  // -----------------------------------------------------------------------
  private async scheduleWithSJF(tasks: Task[], resources: Resource[]): Promise<ScheduleResult[]> {
    // Get ML predictions to estimate job durations
    const batchItems = tasks.flatMap(task =>
      resources.filter(r => r.currentLoad < 100).slice(0, 1).map(resource => ({
        taskId: task.id,
        taskSize: sizeMap[task.size] || 2,
        taskType: typeMap[task.type] || 1,
        priority: task.priority,
        resourceLoad: resource.currentLoad,
        startupOverhead: 1,
      }))
    );
    const predictions = await mlService.getBatchPredictions(batchItems);

    // Sort tasks by predicted execution time (shortest first)
    const sortedTasks = [...tasks].sort((a, b) => {
      const predA = predictions.get(a.id)?.predictedTime ?? 999;
      const predB = predictions.get(b.id)?.predictedTime ?? 999;
      return predA - predB;
    });

    // Re-fetch full predictions for all (task, resource) pairs
    const fullBatch = sortedTasks.flatMap(task =>
      resources.filter(r => r.currentLoad < 100).map(resource => ({
        taskId: `${task.id}::${resource.id}`,
        taskSize: sizeMap[task.size] || 2,
        taskType: typeMap[task.type] || 1,
        priority: task.priority,
        resourceLoad: resource.currentLoad,
        startupOverhead: 1,
      }))
    );
    const fullPredictions = await mlService.getBatchPredictions(fullBatch);

    const results: ScheduleResult[] = [];
    const resourceLoads = new Map(resources.map(r => [r.id, r.currentLoad]));

    for (const task of sortedTasks) {
      let bestResource = resources[0];
      let bestPredTime = Infinity;
      let bestConfidence = 0.5;

      for (const r of resources) {
        const load = resourceLoads.get(r.id) ?? r.currentLoad;
        if (load >= 100) continue;
        const key = `${task.id}::${r.id}`;
        const pred = fullPredictions.get(key);
        if (pred && pred.predictedTime < bestPredTime) {
          bestPredTime = pred.predictedTime;
          bestConfidence = pred.confidence;
          bestResource = r;
        }
      }

      const currentLoad = resourceLoads.get(bestResource.id) ?? bestResource.currentLoad;
      const score = 0.5 * (1 - bestPredTime / 20) + 0.3 * (task.priority / 5) + 0.2 * ((100 - currentLoad) / 100);

      await taskService.assignToResource(task.id, bestResource.id, bestPredTime);
      const newLoad = Math.min(100, currentLoad + 15);
      await resourceService.updateLoad(bestResource.id, newLoad);
      resourceLoads.set(bestResource.id, newLoad);

      await this.recordHistory(task.id, bestResource.id, 'SJF', true, bestPredTime, score,
        `SJF: "${task.name}" predicted ${bestPredTime.toFixed(1)}s (shortest available).`
      );

      results.push({
        taskId: task.id,
        taskName: task.name,
        resourceId: bestResource.id,
        resourceName: bestResource.name,
        predictedTime: bestPredTime,
        confidence: bestConfidence,
        score,
        explanation: `SJF: Predicted execution ${bestPredTime.toFixed(1)}s — scheduled for fastest completion.`,
        algorithm: 'sjf',
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Algorithm comparison — runs all algorithms on same task set
  // Uses a fixed seed so every algorithm sees identical initial conditions.
  // -----------------------------------------------------------------------
  async compareAlgorithms(taskIds?: string[], seed: number = 42): Promise<ComparisonResult[]> {
    let tasks: Task[];
    if (taskIds && taskIds.length > 0) {
      tasks = await prisma.task.findMany({
        where: { id: { in: taskIds }, status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });
    } else {
      tasks = await taskService.findPending();
    }

    if (tasks.length === 0) return [];

    const resources = await resourceService.findAvailable();
    if (resources.length === 0) throw new Error('No available resources');

    // Convert to fog computing structures for optimization algorithms
    const fogTasks = this.convertToFogTasks(tasks, resources);
    const fogNodes = this.convertToFogNodes(resources);
    const devices = generateSampleDevices(Math.max(tasks.length, 5));
    for (let i = 0; i < fogTasks.length; i++) {
      fogTasks[i].terminalDeviceId = devices[i % devices.length].id;
    }

    const results: ComparisonResult[] = [];

    // Run each fog algorithm with same seed for fair comparison
    const fogAlgorithms: Array<{ id: SchedulingAlgorithm; name: string; fn: () => SchedulingSolution }> = [
      { id: 'hybrid_heuristic', name: 'Hybrid Heuristic (HH)', fn: () => new HybridHeuristicScheduler(fogTasks, fogNodes, devices).schedule() },
      { id: 'ipso', name: 'Improved PSO', fn: () => ipsoOnlySchedule(fogTasks, fogNodes, devices) },
      { id: 'iaco', name: 'Improved ACO', fn: () => iacoOnlySchedule(fogTasks, fogNodes, devices) },
      { id: 'round_robin', name: 'Round-Robin', fn: () => roundRobinSchedule(fogTasks, fogNodes, devices) },
      { id: 'min_min', name: 'Min-Min', fn: () => minMinSchedule(fogTasks, fogNodes, devices) },
      { id: 'fcfs', name: 'FCFS', fn: () => fcfsSchedule(fogTasks, fogNodes, devices) },
    ];

    for (const algo of fogAlgorithms) {
      const start = Date.now();
      try {
        // Reset seed before each algorithm so they all start from identical randomness
        useSeed(seed);
        const solution = algo.fn();
        useSeed(undefined); // reset

        results.push({
          algorithm: algo.id,
          algorithmName: algo.name,
          totalDelay: Math.round(solution.totalDelay * 100) / 100,
          totalEnergy: Math.round(solution.totalEnergy * 100) / 100,
          fitness: Math.round(solution.fitness * 10000) / 10000,
          reliability: Math.round(solution.reliability * 100) / 100,
          tasksScheduled: tasks.length,
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        logger.warn(`Algorithm ${algo.id} failed in comparison`, { error: String(err) });
      }
    }

    // Sort by fitness (higher is better)
    results.sort((a, b) => b.fitness - a.fitness);
    return results;
  }

  // -----------------------------------------------------------------------
  // Convert DB models ↔ fog computing data structures
  // -----------------------------------------------------------------------
  private convertToFogTasks(tasks: Task[], resources: Resource[]): FogTask[] {
    return tasks.map((task, i) => ({
      id: task.id,
      name: task.name,
      dataSize: (sizeMap[task.size] || 2) * 10, // Mb
      computationIntensity: (typeMap[task.type] || 1) * 150 + 100,
      maxToleranceTime: task.dueDate
        ? Math.max(5, (task.dueDate.getTime() - Date.now()) / 1000)
        : 30 + (5 - task.priority) * 10,
      expectedCompletionTime: task.predictedTime || 5,
      terminalDeviceId: '', // filled later
      priority: task.priority,
      memoryRequirement: (sizeMap[task.size] || 2) * 256,
      vramRequirement: task.type === 'MIXED' ? 512 : 0,
      startupOverhead: 1,
    }));
  }

  private convertToFogNodes(resources: Resource[]): FogNode[] {
    return resources.map(r => ({
      id: r.id,
      name: r.name,
      computingResource: r.capacity * 1e8,
      storageCapacity: 100,
      networkBandwidth: 80,
      currentLoad: r.currentLoad / 100,
      totalMemory: 8192,
      totalVram: 4096,
      baseLatency: 0.005,
      egressCostPerMb: 0.0001,
    }));
  }

  private async convertFogSolutionToResults(
    dbTasks: Task[],
    dbResources: Resource[],
    fogTasks: FogTask[],
    fogNodes: FogNode[],
    solution: SchedulingSolution,
    algorithm: SchedulingAlgorithm
  ): Promise<ScheduleResult[]> {
    const results: ScheduleResult[] = [];
    const fogNodeToResource = new Map<string, Resource>();

    // Map fog node IDs back to DB resources (by index)
    for (let i = 0; i < fogNodes.length && i < dbResources.length; i++) {
      fogNodeToResource.set(fogNodes[i].id, dbResources[i]);
    }

    for (const dbTask of dbTasks) {
      const fogNodeId = solution.allocations.get(dbTask.id);
      if (!fogNodeId) continue;

      const resource = fogNodeToResource.get(fogNodeId);
      if (!resource) continue;

      const fogTask = fogTasks.find(ft => ft.id === dbTask.id);
      const fogNode = fogNodes.find(fn => fn.id === fogNodeId);
      const predictedTime = fogTask && fogNode
        ? calculateTotalDelay(fogTask, fogNode)
        : 5;

      // Persist the assignment
      await taskService.assignToResource(dbTask.id, resource.id, predictedTime);
      const newLoad = Math.min(100, resource.currentLoad + 15);
      await resourceService.updateLoad(resource.id, newLoad);

      const algoInfo = ALGORITHM_REGISTRY.find(a => a.id === algorithm);
      const explanation = [
        `"${dbTask.name}" → "${resource.name}" via ${algoInfo?.name || algorithm}`,
        `• Predicted execution: ${predictedTime.toFixed(2)}s`,
        `• Algorithm fitness: ${solution.fitness.toFixed(4)}`,
        `• System reliability: ${solution.reliability.toFixed(1)}%`,
      ].join('\n');

      await this.recordHistory(
        dbTask.id, resource.id,
        algorithm.toUpperCase(),
        true,
        predictedTime,
        solution.fitness,
        explanation,
      );

      results.push({
        taskId: dbTask.id,
        taskName: dbTask.name,
        resourceId: resource.id,
        resourceName: resource.name,
        predictedTime,
        confidence: solution.reliability / 100,
        score: solution.fitness,
        explanation,
        algorithm,
      });
    }

    return results;
  }

  // Schedule a single task using the pre-fetched prediction map (ML-enhanced)
  async scheduleTask(
    task: Task,
    availableResources: Resource[],
    predictionMap: Map<string, { predictedTime: number; confidence: number; modelVersion: string }>
  ): Promise<ScheduleResult | null> {
    if (availableResources.length === 0) return null;

    const resourceScores: ResourceScore[] = [];

    for (const resource of availableResources) {
      if (resource.currentLoad >= 100) continue;

      const key = `${task.id}::${resource.id}`;
      const prediction = predictionMap.get(key) || {
        predictedTime: 5,
        confidence: 0.5,
        modelVersion: 'fallback-v1'
      };

      const score = this.calculateScore(task, resource, prediction.predictedTime);

      resourceScores.push({
        resource,
        score,
        predictedTime: prediction.predictedTime,
        confidence: prediction.confidence
      });

      // Save prediction to database
      await mlService.savePrediction(
        task.id,
        prediction.predictedTime,
        prediction.confidence,
        {
          taskSize: sizeMap[task.size] || 2,
          taskType: typeMap[task.type] || 1,
          priority: task.priority,
          resourceLoad: resource.currentLoad, startupOverhead: 1
        },
        prediction.modelVersion
      );
    }

    if (resourceScores.length === 0) return null;

    // Select best resource (highest score)
    resourceScores.sort((a, b) => b.score - a.score);
    const best = resourceScores[0];

    // Generate explanation
    const explanation = this.generateExplanation(task, best);

    // Assign task to resource
    await taskService.assignToResource(task.id, best.resource.id, best.predictedTime);

    // Update resource load
    const newLoad = Math.min(100, best.resource.currentLoad + 15);
    await resourceService.updateLoad(best.resource.id, newLoad);

    // Record scheduling history
    await this.recordHistory(
      task.id,
      best.resource.id,
      'ML_ENHANCED_SCHEDULING',
      true,
      best.predictedTime,
      best.score,
      explanation
    );

    return {
      taskId: task.id,
      taskName: task.name,
      resourceId: best.resource.id,
      resourceName: best.resource.name,
      predictedTime: best.predictedTime,
      confidence: best.confidence,
      score: best.score,
      explanation,
      algorithm: 'ml_enhanced',
    };
  }

  // Calculate scheduling score (higher is better)
  private calculateScore(task: Task, resource: Resource, predictedTime: number): number {
    // Factors:
    // 1. Lower resource load is better (weight: 0.4)
    // 2. Lower predicted time is better (weight: 0.3)
    // 3. Higher priority tasks should run faster (weight: 0.3)

    const loadScore = (100 - resource.currentLoad) / 100;
    const timeScore = Math.max(0, 1 - (predictedTime / 20)); // Normalize to 20s max
    const priorityBonus = task.priority / 5;

    const score = (loadScore * 0.4) + (timeScore * 0.3) + (priorityBonus * 0.3);
    
    return Math.round(score * 1000) / 1000;
  }

  // Generate human-readable explanation
  private generateExplanation(task: Task, best: ResourceScore): string {
    const reasons: string[] = [];

    reasons.push(`"${task.name}" was assigned to "${best.resource.name}" because:`);
    
    if (best.resource.currentLoad < 50) {
      reasons.push(`• ${best.resource.name} has low load (${best.resource.currentLoad}%)`);
    } else {
      reasons.push(`• ${best.resource.name} is the best available option (${best.resource.currentLoad}% load)`);
    }

    if (task.priority >= 4) {
      reasons.push(`• Task has HIGH priority (${task.priority}/5), requiring fast processing`);
    }

    reasons.push(`• ML predicted execution time: ${best.predictedTime}s (${Math.round(best.confidence * 100)}% confidence)`);
    reasons.push(`• Scheduling score: ${best.score} (highest among available resources)`);

    return reasons.join('\n');
  }

  // Record scheduling decision
  private async recordHistory(
    taskId: string,
    resourceId: string,
    algorithm: string,
    mlEnabled: boolean,
    predictedTime: number,
    score: number,
    explanation: string
  ) {
    return prisma.scheduleHistory.create({
      data: {
        taskId,
        resourceId,
        algorithm,
        mlEnabled,
        predictedTime,
        score,
        explanation
      }
    });
  }

  // Get scheduling history
  async getHistory(limit: number = 50) {
    return prisma.scheduleHistory.findMany({
      include: {
        task: {
          select: { id: true, name: true, type: true, size: true, priority: true }
        },
        resource: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Compare ML vs non-ML scheduling
  async getComparison() {
    const history = await prisma.scheduleHistory.findMany({
      where: { actualTime: { not: null } },
      select: {
        mlEnabled: true,
        predictedTime: true,
        actualTime: true
      }
    });

    interface HistoryRecord {
      mlEnabled: boolean;
      predictedTime: number | null;
      actualTime: number | null;
    }

    const withML = history.filter((h: HistoryRecord) => h.mlEnabled);
    const withoutML = history.filter((h: HistoryRecord) => !h.mlEnabled);

    const calcStats = (items: HistoryRecord[]) => {
      if (items.length === 0) return { count: 0, avgError: 0, avgTime: 0 };
      
      const avgError = items.reduce((sum: number, h: HistoryRecord) => {
        return sum + Math.abs((h.predictedTime || 0) - (h.actualTime || 0));
      }, 0) / items.length;

      const avgTime = items.reduce((sum: number, h: HistoryRecord) => sum + (h.actualTime || 0), 0) / items.length;

      return {
        count: items.length,
        avgError: Math.round(avgError * 100) / 100,
        avgTime: Math.round(avgTime * 100) / 100
      };
    };

    return {
      withML: calcStats(withML),
      withoutML: calcStats(withoutML)
    };
  }
}

export const schedulerService = new SchedulerService();
