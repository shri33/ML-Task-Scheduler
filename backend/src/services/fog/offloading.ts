import { Task, FogNode, CloudNode, TerminalDevice, OffloadDecision } from './types';
import { calculateTotalDelay, calculateEnergyConsumption } from './math';
import { HybridHeuristicScheduler } from './algorithms/hybrid';
import logger from '../../lib/logger';

export const defaultCloudNode: CloudNode = {
  id: 'cloud-main',
  name: 'Cloud Data Center',
  computingResource: 100e9,    // 100 GHz effective capacity
  networkBandwidth: 100,       // 100 Mbps WAN
  latencyPenalty: 50,          // 50ms additional latency
  costPerUnit: 0.001,          // $0.001 per computation unit
  baseLatency: 0.05,           // 50ms base latency
  egressCostPerMb: 0.01,       // $0.01 per Mb (100x higher than fog)
  available: true
};

export function calculateCloudExecutionTime(task: Task, cloud: CloudNode): number {
  const baseExecutionTime = (task.dataSize * task.computationIntensity) / cloud.computingResource;
  const transmissionTime = task.dataSize / cloud.networkBandwidth;
  return baseExecutionTime + transmissionTime + (cloud.latencyPenalty / 1000); // Convert ms to s
}

export function calculateCloudCost(task: Task, cloud: CloudNode): number {
  const computationUnits = task.dataSize * task.computationIntensity;
  return computationUnits * cloud.costPerUnit;
}

export function makeOffloadDecision(
  task: Task,
  device: TerminalDevice,
  fogNodes: FogNode[],
  cloud: CloudNode = defaultCloudNode
): OffloadDecision {
  const localDelay = task.dataSize * task.computationIntensity * 1e-6; // Simplified local processing
  const canProcessLocally = localDelay <= task.maxToleranceTime && !device.isMobile;

  let bestFogNode: FogNode | null = null;
  let bestFogDelay = Infinity;
  let bestFogEnergy = 0;

  for (const fogNode of fogNodes) {
    if (fogNode.currentLoad > 0.9) continue;

    const delay = calculateTotalDelay(task, fogNode);
    const energy = calculateEnergyConsumption(task, fogNode, device);

    if (delay <= task.maxToleranceTime && energy <= device.residualEnergy) {
      if (delay < bestFogDelay) {
        bestFogDelay = delay;
        bestFogEnergy = energy;
        bestFogNode = fogNode;
      }
    }
  }

  const cloudDelay = calculateCloudExecutionTime(task, cloud);
  const cloudCost = calculateCloudCost(task, cloud);
  const cloudEnergy = (device.transmissionPower * (task.dataSize / cloud.networkBandwidth)) +
                      (device.idlePower * cloudDelay);

  if (canProcessLocally && localDelay < bestFogDelay) {
    return {
      taskId: task.id,
      offloadTarget: 'local',
      targetId: device.id,
      reason: 'Task can be processed locally with acceptable delay',
      estimatedDelay: localDelay,
      estimatedEnergy: 0,
      estimatedCost: 0
    };
  }

  if (bestFogNode && bestFogDelay <= task.maxToleranceTime) {
    return {
      taskId: task.id,
      offloadTarget: 'fog',
      targetId: bestFogNode.id,
      reason: `Fog node "${bestFogNode.name}" selected with ${Math.round(bestFogNode.currentLoad * 100)}% load`,
      estimatedDelay: bestFogDelay,
      estimatedEnergy: bestFogEnergy,
      estimatedCost: 0
    };
  }

  if (cloud.available) {
    return {
      taskId: task.id,
      offloadTarget: 'cloud',
      targetId: cloud.id,
      reason: 'Offloading to cloud: fog nodes overloaded or cannot meet constraints',
      estimatedDelay: cloudDelay,
      estimatedEnergy: cloudEnergy,
      estimatedCost: cloudCost
    };
  }

  const leastLoadedFog = fogNodes.reduce((min, node) => 
    node.currentLoad < min.currentLoad ? node : min, fogNodes[0]);
  
  return {
    taskId: task.id,
    offloadTarget: 'fog',
    targetId: leastLoadedFog.id,
    reason: 'Forced fog allocation to least loaded node (cloud unavailable)',
    estimatedDelay: calculateTotalDelay(task, leastLoadedFog),
    estimatedEnergy: calculateEnergyConsumption(task, leastLoadedFog, device),
    estimatedCost: 0
  };
}

export function scheduleWith3LayerOffloading(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[],
  cloud: CloudNode = defaultCloudNode
): {
  fogAllocations: Map<string, string>;
  cloudOffloaded: string[];
  localProcessed: string[];
  decisions: OffloadDecision[];
  totalFogDelay: number;
  totalCloudDelay: number;
  totalCost: number;
} {
  logger.info('Starting 3-layer scheduling with cloud offloading');

  const decisions: OffloadDecision[] = [];
  const fogTasks: Task[] = [];
  const cloudOffloaded: string[] = [];
  const localProcessed: string[] = [];
  let totalCloudDelay = 0;
  let totalCost = 0;

  for (const task of tasks) {
    const device = devices.find(d => d.id === task.terminalDeviceId) || devices[0];
    const decision = makeOffloadDecision(task, device, fogNodes, cloud);
    decisions.push(decision);

    if (decision.offloadTarget === 'cloud') {
      cloudOffloaded.push(task.id);
      totalCloudDelay += decision.estimatedDelay;
      totalCost += decision.estimatedCost;
    } else if (decision.offloadTarget === 'local') {
      localProcessed.push(task.id);
    } else {
      fogTasks.push(task);
    }
  }

  let fogAllocations = new Map<string, string>();
  let totalFogDelay = 0;

  if (fogTasks.length > 0) {
    const scheduler = new HybridHeuristicScheduler(fogTasks, fogNodes, devices);
    const fogResult = scheduler.schedule();
    fogAllocations = fogResult.allocations;
    totalFogDelay = fogResult.totalDelay;
  }

  logger.info('3-layer scheduling completed', {
    totalTasks: tasks.length,
    fogTasks: fogTasks.length,
    cloudOffloaded: cloudOffloaded.length,
    localProcessed: localProcessed.length,
    totalCost
  });

  return {
    fogAllocations,
    cloudOffloaded,
    localProcessed,
    decisions,
    totalFogDelay,
    totalCloudDelay,
    totalCost
  };
}
