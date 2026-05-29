import { Task, Resource, ScheduleResult, SchedulingAlgorithm, ALGORITHM_REGISTRY } from '../scheduler.types';
import { schedulerRepository } from '../scheduler.repository';
import { sizeMap, typeMap } from '../scheduler.ml';
import {
  generateSampleDevices,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  roundRobinSchedule,
  minMinSchedule,
  fcfsSchedule,
  HybridHeuristicScheduler,
  calculateTotalDelay,
  Task as FogTask,
  FogNode,
  SchedulingSolution
} from '../../fog';

export async function scheduleWithFogAlgorithm(
  tasks: Task[],
  resources: Resource[],
  algorithm: SchedulingAlgorithm
): Promise<ScheduleResult[]> {
  const fogTasks = convertToFogTasks(tasks, resources);
  const fogNodes = convertToFogNodes(resources);
  const devices = generateSampleDevices(Math.max(tasks.length, 5));

  for (let i = 0; i < fogTasks.length; i++) {
    fogTasks[i].terminalDeviceId = devices[i % devices.length].id;
  }

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

  return convertFogSolutionToResults(tasks, resources, fogTasks, fogNodes, solution, algorithm);
}

function convertToFogTasks(tasks: Task[], resources: Resource[]): FogTask[] {
  return tasks.map((task) => ({
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
}

function convertToFogNodes(resources: Resource[]): FogNode[] {
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

async function convertFogSolutionToResults(
  dbTasks: Task[],
  dbResources: Resource[],
  fogTasks: FogTask[],
  fogNodes: FogNode[],
  solution: SchedulingSolution,
  algorithm: SchedulingAlgorithm
): Promise<ScheduleResult[]> {
  const results: ScheduleResult[] = [];
  const fogNodeToResource = new Map<string, Resource>();

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

    await schedulerRepository.assignToResource(dbTask.id, resource.id, predictedTime);
    const newLoad = Math.min(100, resource.currentLoad + 15);
    await schedulerRepository.updateLoad(resource.id, newLoad);

    const algoInfo = ALGORITHM_REGISTRY.find(a => a.id === algorithm);
    const explanation = [
      `"${dbTask.name}" → "${resource.name}" via ${algoInfo?.name || algorithm}`,
      `• Predicted execution: ${predictedTime.toFixed(2)}s`,
      `• Algorithm fitness: ${solution.fitness.toFixed(4)}`,
      `• System reliability: ${solution.reliability.toFixed(1)}%`,
    ].join('\n');

    await schedulerRepository.recordHistory(
      dbTask.id,
      resource.id,
      algorithm.toUpperCase(),
      true,
      predictedTime,
      solution.fitness,
      explanation
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
export default scheduleWithFogAlgorithm;
