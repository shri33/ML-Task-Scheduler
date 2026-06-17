import { Task, FogNode, TerminalDevice, SchedulingSolution } from '../types';
import { rng, calculateObjectiveFunction, calculateTotalDelay, calculateEnergyConsumption } from '../math';

interface Particle {
  position: number[][]; // n x m matrix (task x fogNode)
  velocity: number[][];
  personalBest: number[][];
  personalBestFitness: number;
}

export class ImprovedPSO {
  private particles: Particle[] = [];
  private globalBest: number[][] = [];
  private globalBestFitness: number = -Infinity;
  
  private readonly numParticles: number;
  private readonly maxIterations: number;
  private readonly wMax: number = 0.9;
  private readonly wMin: number = 0.4;
  private readonly c1: number = 2.0;
  private readonly c2: number = 2.0;
  private readonly vMax: number = 4.0;

  constructor(
    private tasks: Task[],
    private fogNodes: FogNode[],
    private devices: TerminalDevice[],
    numParticles: number = 30,
    maxIterations: number = 100
  ) {
    this.numParticles = numParticles;
    this.maxIterations = maxIterations;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private calculateInertiaWeight(iteration: number): number {
    if (iteration < 0.7 * this.maxIterations) {
      return this.wMax - ((this.wMax - this.wMin) * iteration) / this.maxIterations;
    }
    return this.wMin + (this.wMax - this.wMin) * rng();
  }

  private calculateContractionFactor(): number {
    const phi = this.c1 + this.c2;
    if (phi <= 4) return 1;
    return (2 * 1) / Math.abs(2 - phi - Math.sqrt(phi * phi - 4 * phi));
  }

  private initializeParticles(): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;

    for (let p = 0; p < this.numParticles; p++) {
      const position: number[][] = [];
      const velocity: number[][] = [];

      for (let i = 0; i < n; i++) {
        const posRow: number[] = new Array(m).fill(0);
        const velRow: number[] = [];
        
        const selectedFog = Math.floor(rng() * m);
        posRow[selectedFog] = 1;
        
        for (let j = 0; j < m; j++) {
          velRow.push((rng() * 2 - 1) * this.vMax);
        }
        
        position.push(posRow);
        velocity.push(velRow);
      }

      const particle: Particle = {
        position,
        velocity,
        personalBest: position.map(row => [...row]),
        personalBestFitness: -Infinity
      };

      this.particles.push(particle);
    }
  }

  private positionToAllocation(position: number[][]): Map<string, string> {
    const allocations = new Map<string, string>();
    
    for (let i = 0; i < this.tasks.length; i++) {
      for (let j = 0; j < this.fogNodes.length; j++) {
        if (position[i][j] === 1) {
          allocations.set(this.tasks[i].id, this.fogNodes[j].id);
          break;
        }
      }
    }
    
    return allocations;
  }

  private evaluateFitness(position: number[][]): number {
    const allocations = this.positionToAllocation(position);
    const result = calculateObjectiveFunction(allocations, this.tasks, this.fogNodes, this.devices);
    return result.fitness;
  }

  private updateParticle(particle: Particle, iteration: number): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;
    const w = this.calculateInertiaWeight(iteration);
    const eta = this.calculateContractionFactor();

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const r1 = rng();
        const r2 = rng();
        
        particle.velocity[i][j] = eta * (
          w * particle.velocity[i][j] +
          this.c1 * r1 * (particle.personalBest[i][j] - particle.position[i][j]) +
          this.c2 * r2 * (this.globalBest[i][j] - particle.position[i][j])
        );

        particle.velocity[i][j] = Math.max(-this.vMax, Math.min(this.vMax, particle.velocity[i][j]));
      }
    }

    for (let i = 0; i < n; i++) {
      const sigValues = particle.velocity[i].map(v => this.sigmoid(v));
      const maxIdx = sigValues.indexOf(Math.max(...sigValues));
      
      particle.position[i] = new Array(m).fill(0);
      particle.position[i][maxIdx] = 1;
    }
  }

  run(): { bestPosition: number[][]; bestFitness: number } {
    this.initializeParticles();

    for (const particle of this.particles) {
      const fitness = this.evaluateFitness(particle.position);
      particle.personalBestFitness = fitness;
      particle.personalBest = particle.position.map(row => [...row]);

      if (fitness > this.globalBestFitness) {
        this.globalBestFitness = fitness;
        this.globalBest = particle.position.map(row => [...row]);
      }
    }

    for (let iter = 0; iter < this.maxIterations; iter++) {
      for (const particle of this.particles) {
        this.updateParticle(particle, iter);

        const fitness = this.evaluateFitness(particle.position);

        if (fitness > particle.personalBestFitness) {
          particle.personalBestFitness = fitness;
          particle.personalBest = particle.position.map(row => [...row]);
        }

        if (fitness > this.globalBestFitness) {
          this.globalBestFitness = fitness;
          this.globalBest = particle.position.map(row => [...row]);
        }
      }
    }

    return {
      bestPosition: this.globalBest,
      bestFitness: this.globalBestFitness
    };
  }
}

export function ipsoOnlySchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const ipso = new ImprovedPSO(tasks, fogNodes, devices, 30, 100);
  const psoResult = ipso.run();
  
  const allocations = new Map<string, string>();
  for (let i = 0; i < tasks.length; i++) {
    for (let j = 0; j < fogNodes.length; j++) {
      if (psoResult.bestPosition[i][j] === 1) {
        allocations.set(tasks[i].id, fogNodes[j].id);
        break;
      }
    }
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
