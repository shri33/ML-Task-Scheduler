import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { rng, calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';

interface Ant {
  path: number[]; // path[i] = j means task i is assigned to fog node j
  pathLength: number;
}

export class ImprovedACO {
  private pheromone: number[][] = [];
  private bestPath: number[] = [];
  private bestPathLength: number = Infinity;

  private readonly numAnts: number;
  private readonly maxIterations: number;
  private readonly alpha: number = 1.0;  // Pheromone weight
  private readonly beta: number = 1.0;   // Heuristic weight
  private readonly rho: number = 0.5;    // Evaporation rate
  private readonly Q: number = 100;      // Pheromone constant

  constructor(
    private tasks: Task[],
    private fogNodes: FogNode[],
    private devices: TerminalDevice[],
    numAnts: number = 30,
    maxIterations: number = 100,
    initialPheromone?: number[][]
  ) {
    this.numAnts = numAnts;
    this.maxIterations = maxIterations;
    this.initializePheromone(initialPheromone);
  }

  private initializePheromone(initial?: number[][]): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;

    if (initial) {
      this.pheromone = initial.map(row => row.map(v => v + 0.1));
    } else {
      this.pheromone = [];
      for (let i = 0; i < n; i++) {
        this.pheromone.push(new Array(m).fill(1.0));
      }
    }
  }

  private calculateOverhead(taskIdx: number, fogIdx: number): number {
    const task = this.tasks[taskIdx];
    const fogNode = this.fogNodes[fogIdx];
    const device = this.devices.find(d => d.id === task.terminalDeviceId);
    
    if (!device) return Infinity;

    const delay = calculateTotalDelay(task, fogNode);
    const energy = calculateEnergyConsumption(task, fogNode, device);
    
    return device.delayWeight * delay + device.energyWeight * energy;
  }

  private calculateHeuristic(taskIdx: number, fogIdx: number, previousOverhead: number): number {
    const currentOverhead = this.calculateOverhead(taskIdx, fogIdx);
    const w1 = 0.6;
    const w2 = 0.4;

    const localHeuristic = currentOverhead > 0 ? 1 / currentOverhead : 1;
    const globalHeuristic = previousOverhead > 0 ? 1 / previousOverhead : 1;

    return w1 * localHeuristic + w2 * globalHeuristic;
  }

  private calculateRegulatoryFactor(taskIdx: number, fogIdx: number): number {
    const avgPheromone = this.pheromone[taskIdx].reduce((a, b) => a + b, 0) / this.fogNodes.length;
    return Math.exp(-Math.abs(this.pheromone[taskIdx][fogIdx] - avgPheromone));
  }

  private calculateTransitionProbability(taskIdx: number, previousOverhead: number): number[] {
    const probabilities: number[] = [];
    let sum = 0;

    for (let j = 0; j < this.fogNodes.length; j++) {
      const tau = Math.pow(this.pheromone[taskIdx][j], this.alpha);
      const eta = Math.pow(this.calculateHeuristic(taskIdx, j, previousOverhead), this.beta);
      const mu = this.calculateRegulatoryFactor(taskIdx, j);
      
      const value = tau * eta * mu;
      probabilities.push(value);
      sum += value;
    }

    return probabilities.map(p => p / sum);
  }

  private selectFogNode(probabilities: number[]): number {
    const rand = rng();
    let cumulative = 0;

    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j];
      if (rand <= cumulative) {
        return j;
      }
    }

    return probabilities.length - 1;
  }

  private constructSolution(): Ant {
    const path: number[] = [];
    let totalOverhead = 0;
    let previousOverhead = 0;

    for (let i = 0; i < this.tasks.length; i++) {
      const probabilities = this.calculateTransitionProbability(i, previousOverhead);
      const selectedFog = this.selectFogNode(probabilities);
      path.push(selectedFog);
      
      const overhead = this.calculateOverhead(i, selectedFog);
      totalOverhead += overhead;
      previousOverhead += overhead;
    }

    return { path, pathLength: totalOverhead };
  }

  private updateLocalPheromone(ant: Ant): void {
    for (let i = 0; i < this.tasks.length; i++) {
      const j = ant.path[i];
      const overhead = this.calculateOverhead(i, j);
      const deltaTau = overhead > 0 ? this.Q / overhead : 0;
      
      this.pheromone[i][j] = (1 - this.rho) * this.pheromone[i][j] + deltaTau;
    }
  }

  private updateGlobalPheromone(ants: Ant[]): void {
    for (let i = 0; i < this.tasks.length; i++) {
      for (let j = 0; j < this.fogNodes.length; j++) {
        this.pheromone[i][j] *= (1 - this.rho);
      }
    }

    for (const ant of ants) {
      const deltaTau = ant.pathLength > 0 ? this.Q / ant.pathLength : 0;
      for (let i = 0; i < this.tasks.length; i++) {
        const j = ant.path[i];
        this.pheromone[i][j] += deltaTau;
      }
    }
  }

  run(): { bestPath: number[]; bestPathLength: number } {
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const ants: Ant[] = [];

      for (let k = 0; k < this.numAnts; k++) {
        const ant = this.constructSolution();
        ants.push(ant);

        this.updateLocalPheromone(ant);

        if (ant.pathLength < this.bestPathLength) {
          this.bestPathLength = ant.pathLength;
          this.bestPath = [...ant.path];
        }
      }

      this.updateGlobalPheromone(ants);
    }

    return {
      bestPath: this.bestPath,
      bestPathLength: this.bestPathLength
    };
  }
}

export function iacoOnlySchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const iaco = new ImprovedACO(tasks, fogNodes, devices, 30, 100);
  const acoResult = iaco.run();
  
  const allocations = new Map<string, string>();
  for (let i = 0; i < tasks.length; i++) {
    allocations.set(tasks[i].id, fogNodes[acoResult.bestPath[i]].id);
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
