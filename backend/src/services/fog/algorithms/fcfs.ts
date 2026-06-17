import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';

export function fcfsSchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const allocations = new Map<string, string>();
  const fogNodeLoads = new Map<string, number>();
  fogNodes.forEach(f => fogNodeLoads.set(f.id, f.currentLoad));

  for (const task of tasks) {
    let bestFogNode = fogNodes[0];
    let minLoad = Infinity;

    for (const fogNode of fogNodes) {
      const currentLoad = fogNodeLoads.get(fogNode.id) || 0;
      if (currentLoad < minLoad) {
        minLoad = currentLoad;
        bestFogNode = fogNode;
      }
    }

    allocations.set(task.id, bestFogNode.id);
    
    const delay = calculateTotalDelay(task, bestFogNode);
    fogNodeLoads.set(bestFogNode.id, (fogNodeLoads.get(bestFogNode.id) || 0) + delay * 0.1);
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
