import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';
import { ImprovedPSO } from './ipso';
import { ImprovedACO } from './iaco';
import logger from '../../../lib/logger';

export class HybridHeuristicScheduler {
  constructor(
    private tasks: Task[],
    private fogNodes: FogNode[],
    private devices: TerminalDevice[]
  ) {}

  schedule(): SchedulingSolution {
    logger.debug('Starting Hybrid Heuristic (HH) Algorithm', { tasks: this.tasks.length, fogNodes: this.fogNodes.length });

    // Step 1: Run IPSO
    logger.debug('Phase 1: Running Improved PSO');
    const ipso = new ImprovedPSO(this.tasks, this.fogNodes, this.devices, 30, 50);
    const psoResult = ipso.run();
    logger.debug('PSO completed', { bestFitness: psoResult.bestFitness });

    // Step 2: Use PSO result as initial pheromone for ACO
    logger.debug('Phase 2: Running Improved ACO');
    const iaco = new ImprovedACO(
      this.tasks, 
      this.fogNodes, 
      this.devices, 
      30, 
      50,
      psoResult.bestPosition // Initial pheromone from PSO
    );
    const acoResult = iaco.run();
    logger.debug('ACO completed', { bestPathLength: acoResult.bestPathLength });

    // Convert ACO result to allocation map
    const allocations = new Map<string, string>();
    for (let i = 0; i < this.tasks.length; i++) {
      allocations.set(this.tasks[i].id, this.fogNodes[acoResult.bestPath[i]].id);
    }

    // Calculate final metrics
    const result = calculateObjectiveFunction(allocations, this.tasks, this.fogNodes, this.devices);
    
    // Calculate reliability
    let successfulTasks = 0;
    for (const task of this.tasks) {
      const fogNodeId = allocations.get(task.id);
      if (!fogNodeId) continue;

      const fogNode = this.fogNodes.find(f => f.id === fogNodeId);
      const device = this.devices.find(d => d.id === task.terminalDeviceId);
      if (!fogNode || !device) continue;

      const delay = calculateTotalDelay(task, fogNode);
      const energy = calculateEnergyConsumption(task, fogNode, device);

      const meetsHardwareRequirements = 
        fogNode.totalMemory >= task.memoryRequirement && 
        fogNode.totalVram >= task.vramRequirement;

      if (delay <= task.maxToleranceTime && energy <= device.residualEnergy && meetsHardwareRequirements) {
        successfulTasks++;
      }
    }
    const reliability = (successfulTasks / this.tasks.length) * 100;

    logger.debug('HH Algorithm completed', { 
      totalDelay: result.totalDelay, 
      totalEnergy: result.totalEnergy, 
      reliability 
    });

    return {
      allocations,
      totalDelay: result.totalDelay,
      totalEnergy: result.totalEnergy,
      fitness: result.fitness,
      reliability
    };
  }
}
