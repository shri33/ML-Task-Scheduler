import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';

export function minMinSchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const allocations = new Map<string, string>();
  const fogNodeLoads = new Map<string, number>();
  fogNodes.forEach(f => fogNodeLoads.set(f.id, 0));

  // Sort tasks by data size (smallest first)
  const sortedTasks = [...tasks].sort((a, b) => a.dataSize - b.dataSize);

  for (const task of sortedTasks) {
    let minDelay = Infinity;
    let bestFogNode = fogNodes[0];

    for (const fogNode of fogNodes) {
      const delay = calculateTotalDelay(task, fogNode);
      const adjustedDelay = delay + (fogNodeLoads.get(fogNode.id) || 0);

      if (adjustedDelay < minDelay) {
        minDelay = adjustedDelay;
        bestFogNode = fogNode;
      }
    }

    allocations.set(task.id, bestFogNode.id);
    fogNodeLoads.set(bestFogNode.id, (fogNodeLoads.get(bestFogNode.id) || 0) + minDelay);
  }

  const result = calculateObjectiveFunction(allocations, tasks, fogNodes, devices);
  
  let successfulTasks = 0;
  for (const task of tasks) {
    const fogNodeId = allocations.get(task.id);
    if (!fogNodeId) continue;

    const fogNode = fogNodes.find(f => f.id === fogNodeId);
    const device = devices.find(d => d.id === task.terminalDeviceId);
    if (!fogNode || !device) continue;

    const delay = calculateTotalDelay(task, fogNode);
    const energy = calculateEnergyConsumption(task, fogNode, device);

    if (delay <= task.maxToleranceTime && energy <= device.residualEnergy) {
      successfulTasks++;
    }
  }

  return {
    allocations,
    totalDelay: result.totalDelay,
    totalEnergy: result.totalEnergy,
    fitness: result.fitness,
    reliability: (successfulTasks / tasks.length) * 100
  };
}
