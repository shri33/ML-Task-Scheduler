import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';

export function roundRobinSchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const allocations = new Map<string, string>();
  
  for (let i = 0; i < tasks.length; i++) {
    const fogNodeIdx = i % fogNodes.length;
    allocations.set(tasks[i].id, fogNodes[fogNodeIdx].id);
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
