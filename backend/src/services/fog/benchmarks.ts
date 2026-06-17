import { Task, FogNode, TerminalDevice, CloudNode, SchedulingSolution } from './types';
import { rng, calculateTotalDelay, calculateEnergyConsumption } from './math';
import { HybridHeuristicScheduler } from './algorithms/hybrid';
import { ipsoOnlySchedule } from './algorithms/ipso';
import { iacoOnlySchedule } from './algorithms/iaco';
import { roundRobinSchedule } from './algorithms/round-robin';
import { minMinSchedule } from './algorithms/min-min';
import { fcfsSchedule } from './algorithms/fcfs';
import logger from '../../lib/logger';

export function generateSampleDevices(count: number): TerminalDevice[] {
  const devices: TerminalDevice[] = [];
  for (let i = 0; i < count; i++) {
    const isMobile = rng() > 0.5;
    devices.push({
      id: `device-${i + 1}`,
      name: `Terminal-${i + 1}`,
      transmissionPower: 0.1, // 0.1W
      idlePower: 0.05, // 0.05W
      isMobile,
      delayWeight: isMobile ? 0.7 : 1.0,
      energyWeight: isMobile ? 0.3 : 0.0,
      residualEnergy: isMobile ? 1000 + rng() * 500 : Infinity
    });
  }
  return devices;
}

export function generateSampleTasks(count: number, devices: TerminalDevice[]): Task[] {
  const tasks: Task[] = [];
  const taskTypes = ['DETECTION', 'SCHEDULING', 'MONITORING', 'ANALYSIS', 'STORAGE'];
  for (let i = 0; i < count; i++) {
    const dataSize = 10 + rng() * 40; // 10-50 Mb
    tasks.push({
      id: `task-${i + 1}`,
      name: `${taskTypes[i % taskTypes.length]}-${i + 1}`,
      dataSize,
      computationIntensity: 200 + rng() * 200, // 200-400 cycles/bit
      maxToleranceTime: 5 + rng() * 45, // 5-50 seconds
      expectedCompletionTime: 2 + rng() * 8, // 2-10 seconds
      terminalDeviceId: devices[i % devices.length].id,
      priority: Math.floor(rng() * 5) + 1, // 1-5
      memoryRequirement: 128 + rng() * 1024, // 128MB - 1GB
      vramRequirement: rng() > 0.7 ? 512 + rng() * 2048 : 0, // Occasional GPU task
      startupOverhead: 0.5 + rng() * 2.5 // 0.5 - 3s
    });
  }
  return tasks;
}

export function generateSampleFogNodes(count: number): FogNode[] {
  const fogNodes: FogNode[] = [];
  for (let i = 0; i < count; i++) {
    fogNodes.push({
      id: `fog-${i + 1}`,
      name: `FogNode-${i + 1}`,
      computingResource: (1 + rng()) * 1e9, // 1-2 GHz
      storageCapacity: 50 + rng() * 150, // 50-200 GB
      networkBandwidth: 50 + rng() * 50, // 50-100 Mbps
      currentLoad: rng() * 0.5, // 0-50% load
      totalMemory: 4096 + rng() * 12288,
      totalVram: rng() > 0.5 ? 4096 + rng() * 4096 : 0,
      baseLatency: 0.002 + rng() * 0.01,
      egressCostPerMb: 0.0001
    });
  }
  return fogNodes;
}

export function runAlgorithmComparison(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): {
  hh: SchedulingSolution;
  ipso: SchedulingSolution;
  iaco: SchedulingSolution;
  rr: SchedulingSolution;
  minMin: SchedulingSolution;
} {
  logger.debug('Starting Algorithm Comparison');

  const hhScheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
  const hh = hhScheduler.schedule();

  logger.debug('Running IPSO-Only');
  const ipso = ipsoOnlySchedule(tasks, fogNodes, devices);

  logger.debug('Running IACO-Only');
  const iaco = iacoOnlySchedule(tasks, fogNodes, devices);

  logger.debug('Running Round-Robin');
  const rr = roundRobinSchedule(tasks, fogNodes, devices);

  logger.debug('Running Min-Min');
  const minMin = minMinSchedule(tasks, fogNodes, devices);

  logger.info('Algorithm comparison completed', {
    hh: { delay: hh.totalDelay, energy: hh.totalEnergy, reliability: hh.reliability },
    ipso: { delay: ipso.totalDelay, energy: ipso.totalEnergy, reliability: ipso.reliability },
    iaco: { delay: iaco.totalDelay, energy: iaco.totalEnergy, reliability: iaco.reliability },
    rr: { delay: rr.totalDelay, energy: rr.totalEnergy, reliability: rr.reliability },
    minMin: { delay: minMin.totalDelay, energy: minMin.totalEnergy, reliability: minMin.reliability }
  });

  return { hh, ipso, iaco, rr, minMin };
}

export function generateSampleCloudNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: overrides.id ?? 'cloud-1',
    name: overrides.name ?? 'AWS Cloud',
    computingResource: overrides.computingResource ?? 100e9,
    networkBandwidth: overrides.networkBandwidth ?? 100,
    latencyPenalty: overrides.latencyPenalty ?? 50,
    costPerUnit: overrides.costPerUnit ?? 0.001,
    baseLatency: overrides.baseLatency ?? 0.05,
    egressCostPerMb: overrides.egressCostPerMb ?? 0.01,
    available: overrides.available ?? true
  };
}
