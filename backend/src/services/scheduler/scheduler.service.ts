import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { taskService } from '../task.service';
import { resourceService } from '../resource.service';
import logger from '../../lib/logger';
import {
  generateSampleDevices,
  useSeed,
  HybridHeuristicScheduler,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  roundRobinSchedule,
  minMinSchedule,
  fcfsSchedule,
} from '../fog';
import {
  Task,
  Resource,
  ScheduleResult,
  SchedulingAlgorithm,
  SchedulingContext,
  ComparisonResult,
  ALGORITHM_REGISTRY
} from './scheduler.types';
import { schedulerRepository } from './scheduler.repository';
import { schedulerMLIntegration } from './scheduler.ml';
import { withSchedulerLock } from './scheduler.lock';
import { scheduleRoundRobin } from './algorithms/round-robin';
import { scheduleEDF } from './algorithms/edf';
import { scheduleSJF } from './algorithms/sjf';
import { scheduleMLEnhanced } from './algorithms/ml-enhanced';
import { scheduleWithFogAlgorithm } from './algorithms/fog-hybrid';

export class SchedulerService {
  computeLoadDelta(task: { size: string }): number {
    const map: Record<string, number> = { SMALL: 10, MEDIUM: 15, LARGE: 25 };
    return map[task.size] ?? 15;
  }

  async schedule(
    taskIds?: string[],
    algorithm: SchedulingAlgorithm = 'ml_enhanced',
    context: SchedulingContext = {}
  ): Promise<ScheduleResult[]> {
    const startTime = Date.now();
    const timeBudget = context.timeBudgetMs ?? 30_000;
    
    // Lock integration: wrap the whole scheduling flow with the scheduler lock
    const results = await withSchedulerLock(async () => {
      if (context.seed !== undefined) {
        useSeed(context.seed);
      }

      // Fetch pending tasks (Phase 3 optimization: Paginate scheduler hot path)
      let tasks: Task[];
      if (taskIds && taskIds.length > 0) {
        const dbTasks = await prisma.task.findMany({
          where: { id: { in: taskIds }, status: 'PENDING' },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        });
        tasks = dbTasks.map(t => ({
          ...t,
          predictedTime: t.predictedTime,
          actualTime: t.actualTime,
          resourceId: t.resourceId,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
          scheduledAt: t.scheduledAt,
          completedAt: t.completedAt
        })) as Task[];
      } else {
        tasks = await schedulerRepository.findPending(100);
      }

      if (tasks.length === 0) {
        if (context.seed !== undefined) useSeed(undefined);
        return [];
      }

      // Get available resources
      const resources = await schedulerRepository.findAvailableResources();
      if (resources.length === 0) {
        if (context.seed !== undefined) useSeed(undefined);
        throw new Error('No available resources for scheduling');
      }

      logger.info(`Scheduling ${tasks.length} tasks with algorithm: ${algorithm}`, {
        seed: context.seed,
        timeBudgetMs: timeBudget,
        hasUserProfile: !!context.userProfile,
      });

      let scheduleResults: ScheduleResult[];

      switch (algorithm) {
        case 'ml_enhanced':
          scheduleResults = await scheduleMLEnhanced(tasks, resources);
          break;

        case 'hybrid_heuristic':
        case 'ipso':
        case 'iaco':
        case 'round_robin':
        case 'min_min':
        case 'fcfs':
          scheduleResults = await scheduleWithFogAlgorithm(tasks, resources, algorithm);
          break;

        case 'edf':
          scheduleResults = await scheduleEDF(tasks, resources);
          break;

        case 'sjf':
          scheduleResults = await scheduleSJF(tasks, resources);
          break;

        case 'rl_ppo':
          scheduleResults = await this.scheduleWithRL(tasks, resources);
          break;

        default:
          scheduleResults = await scheduleMLEnhanced(tasks, resources);
      }

      if (context.seed !== undefined) useSeed(undefined);

      const latencyMs = Date.now() - startTime;
      logger.info(`Scheduling completed: ${scheduleResults.length} tasks in ${latencyMs}ms using ${algorithm}`);

      return scheduleResults;
    });

    if (results === null) {
      throw new Error('Scheduler is currently busy. Please try again in a moment.');
    }

    return results;
  }

  private async scheduleWithRL(tasks: Task[], resources: Resource[]): Promise<ScheduleResult[]> {
    const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
    const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

    const rlPayload = tasks.map(task => ({
      taskId: task.id,
      taskSize: sizeMap[task.size] || 2,
      taskType: typeMap[task.type] || 1,
      priority: task.priority,
      resourceLoad: resources.length > 0
        ? resources.reduce((s, r) => s + r.currentLoad, 0) / resources.length
        : 50,
      dueDate: task.dueDate
        ? Math.max(1, (task.dueDate.getTime() - Date.now()) / 1000)
        : null,
    }));

    let orderedTaskIds: string[] = tasks.map(t => t.id);
    let agentUsed = false;
    try {
      const response = await schedulerMLIntegration.getRLSchedulingOrder(rlPayload);
      if (response && response.schedulingOrder.length > 0) {
        orderedTaskIds = response.schedulingOrder;
        agentUsed = response.agentUsed;
      }
    } catch (err) {
      logger.warn('RL endpoint unreachable, falling back to ml_enhanced', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const orderedTasks: Task[] = [];
    for (const id of orderedTaskIds) {
      const t = taskMap.get(id);
      if (t) orderedTasks.push(t);
    }
    const seen = new Set(orderedTaskIds);
    for (const t of tasks) {
      if (!seen.has(t.id)) orderedTasks.push(t);
    }

    const batchItems = orderedTasks.flatMap(task =>
      resources
        .filter(r => r.currentLoad < 100)
        .map(resource => ({
          taskId: `${task.id}::${resource.id}`,
          taskSize: sizeMap[task.size] || 2,
          taskType: typeMap[task.type] || 1,
          priority: task.priority,
          resourceLoad: resource.currentLoad,
          startupOverhead: 1,
        }))
    );
    const predictions = await schedulerMLIntegration.getBatchPredictions(batchItems);

    const results: ScheduleResult[] = [];
    const resourceLoads = new Map(resources.map(r => [r.id, r.currentLoad]));

    for (const task of orderedTasks) {
      let bestResource = resources[0];
      let bestPredTime = Infinity;
      let bestConf = 0.5;

      for (const r of resources) {
        const load = resourceLoads.get(r.id) ?? r.currentLoad;
        if (load >= 100) continue;
        const key = `${task.id}::${r.id}`;
        const pred = predictions.get(key);
        if (pred && pred.predictedTime < bestPredTime) {
          bestPredTime = pred.predictedTime;
          bestConf = pred.confidence;
          bestResource = r;
        }
      }
      if (bestPredTime === Infinity) bestPredTime = 5;

      const currentLoad = resourceLoads.get(bestResource.id) ?? bestResource.currentLoad;
      const loadDelta = this.computeLoadDelta(task);
      const score =
        0.4 * ((100 - currentLoad) / 100) +
        0.3 * Math.max(0, 1 - bestPredTime / 20) +
        0.3 * (task.priority / 5);

      await schedulerRepository.assignToResource(task.id, bestResource.id, bestPredTime);
      const newLoad = Math.min(100, currentLoad + loadDelta);
      await schedulerRepository.updateLoad(bestResource.id, newLoad);
      resourceLoads.set(bestResource.id, newLoad);

      await schedulerRepository.recordHistory(
        task.id, bestResource.id,
        agentUsed ? 'RL_PPO' : 'RL_PPO_FALLBACK',
        true, bestPredTime, score,
        `RL_PPO: "${task.name}" → "${bestResource.name}" (agent=${agentUsed}, pred=${bestPredTime.toFixed(1)}s)`,
      );

      results.push({
        taskId: task.id,
        taskName: task.name,
        resourceId: bestResource.id,
        resourceName: bestResource.name,
        predictedTime: bestPredTime,
        confidence: bestConf,
        score,
        explanation: `RL_PPO ordering (agentUsed=${agentUsed}). Assigned to least-loaded resource with ML time estimate.`,
        algorithm: 'rl_ppo',
      });
    }

    return results;
  }

  async compareAlgorithms(taskIds?: string[], seed: number = 42): Promise<ComparisonResult[]> {
    let tasks: Task[];
    if (taskIds && taskIds.length > 0) {
      const dbTasks = await prisma.task.findMany({
        where: { id: { in: taskIds }, status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });
      tasks = dbTasks.map(t => ({
        ...t,
        predictedTime: t.predictedTime,
        actualTime: t.actualTime,
        resourceId: t.resourceId,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        scheduledAt: t.scheduledAt,
        completedAt: t.completedAt
      })) as Task[];
    } else {
      tasks = await schedulerRepository.findPending(100);
    }

    if (tasks.length === 0) return [];

    const resources = await schedulerRepository.findAvailableResources();
    if (resources.length === 0) throw new Error('No available resources');

    const sizeMap: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
    const typeMap: Record<string, number> = { CPU: 1, IO: 2, MIXED: 3 };

    // Convert to fog computing structures
    const fogTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      dataSize: (sizeMap[task.size] || 2) * 10,
      computationIntensity: (typeMap[task.type] || 1) * 150 + 100,
      maxToleranceTime: task.dueDate
        ? Math.max(5, (task.dueDate.getTime() - Date.now()) / 1000)
        : 30 + (5 - task.priority) * 10,
      expectedCompletionTime: task.predictedTime || 5,
      terminalDeviceId: '',
      priority: task.priority,
      memoryRequirement: (sizeMap[task.size] || 2) * 256,
      vramRequirement: task.type === 'MIXED' ? 512 : 0,
      startupOverhead: 1,
    }));

    const fogNodes = resources.map(r => ({
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

    const devices = generateSampleDevices(Math.max(tasks.length, 5));
    for (let i = 0; i < fogTasks.length; i++) {
      fogTasks[i].terminalDeviceId = devices[i % devices.length].id;
    }

    const results: ComparisonResult[] = [];

    const fogAlgorithms: Array<{ id: SchedulingAlgorithm; name: string; fn: () => any }> = [
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
        useSeed(seed);
        const solution = algo.fn();
        useSeed(undefined);

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

    results.sort((a, b) => b.fitness - a.fitness);
    return results;
  }

  async getHistory(limit: number = 50) {
    return schedulerRepository.getHistory(limit);
  }

  async getComparison() {
    return schedulerRepository.getComparison();
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;

export function makeScheduleJobId(userId: string | undefined, taskIds: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update((taskIds || []).slice().sort().join(','))
    .digest('hex');
  return `schedule:${userId || 'system'}:${hash}`;
}
