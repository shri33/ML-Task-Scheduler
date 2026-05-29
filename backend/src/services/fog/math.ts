import { Task, FogNode, CloudNode, TerminalDevice } from './types';

// ==================== SEEDED PRNG (reproducible benchmarks) ====================
let _seed = 0;
function seedRandom(s: number) { _seed = s | 0; }
function seededRandom(): number {
  let t = (_seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Default: use Math.random unless a seed is set
export let rng = Math.random;
export function useSeed(seed?: number) {
  if (seed !== undefined) {
    seedRandom(seed);
    rng = seededRandom;
  } else {
    rng = Math.random;
  }
}

/**
 * Calculate execution time of task Ii at fog node Fj
 * TEij = Di * θi / Cj
 */
export function calculateExecutionTime(task: Task, fogNode: FogNode): number {
  const dataSizeBits = task.dataSize * 1e6 * 8; // Convert Mb to bits
  const totalCycles = dataSizeBits * task.computationIntensity;
  return totalCycles / fogNode.computingResource;
}

/**
 * Calculate transmission time to send task Ii to fog node Fj
 */
export function calculateTransmissionTime(task: Task, fogNode: FogNode | CloudNode): number {
  return fogNode.baseLatency + (task.dataSize / fogNode.networkBandwidth);
}

/**
 * Calculate total delay
 */
export function calculateTotalDelay(task: Task, fogNode: FogNode | CloudNode): number {
  const baseDelay = calculateTransmissionTime(task, fogNode) + calculateExecutionTime(task, fogNode as FogNode);
  return baseDelay + task.startupOverhead;
}

/**
 * Calculate energy consumption
 */
export function calculateEnergyConsumption(
  task: Task,
  fogNode: FogNode,
  device: TerminalDevice
): number {
  const transmissionTime = calculateTransmissionTime(task, fogNode);
  const executionTime = calculateExecutionTime(task, fogNode);
  return transmissionTime * device.transmissionPower + executionTime * device.idlePower;
}

/**
 * Calculate egress cost
 */
export function calculateEgressCost(task: Task, fogNode: FogNode | CloudNode): number {
  return task.dataSize * fogNode.egressCostPerMb;
}

/**
 * Calculate objective function value
 */
export function calculateObjectiveFunction(
  allocations: Map<string, string>,
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): { totalDelay: number; totalEnergy: number; fitness: number } {
  let totalDelay = 0;
  let totalEnergy = 0;
  let totalEgressCost = 0;

  const fogNodeMap = new Map(fogNodes.map(f => [f.id, f]));
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  for (const task of tasks) {
    const fogNodeId = allocations.get(task.id);
    if (!fogNodeId) continue;

    const fogNode = fogNodeMap.get(fogNodeId);
    const device = deviceMap.get(task.terminalDeviceId);
    if (!fogNode || !device) continue;

    const delay = calculateTotalDelay(task, fogNode);
    const energy = calculateEnergyConsumption(task, fogNode, device);
    const egressCost = calculateEgressCost(task, fogNode);

    // Hardware constraint penalty (Phase 7 Hardening)
    let hardwarePenalty = 0;
    if (task.memoryRequirement > fogNode.totalMemory) {
      hardwarePenalty += 1000 * (task.memoryRequirement / fogNode.totalMemory);
    }
    if (task.vramRequirement > fogNode.totalVram) {
      hardwarePenalty += 1000 * (task.vramRequirement / fogNode.totalVram);
    }

    totalDelay += device.delayWeight * delay;
    totalEnergy += device.energyWeight * energy;
    totalEgressCost += egressCost + hardwarePenalty;
  }

  // Final objective combines delay, energy, and financial cost
  const objectiveValue = totalDelay + totalEnergy + (totalEgressCost * 10);
  const fitness = objectiveValue > 0 ? 1 / objectiveValue : 1e-10;

  return { totalDelay, totalEnergy, fitness };
}
