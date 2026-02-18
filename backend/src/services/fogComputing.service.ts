/**
 * Fog Computing Task Scheduling Service
 * Based on: "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing"
 * Authors: Juan Wang and Di Li (2019)
 * 
 * Implements:
 * - Improved Particle Swarm Optimization (IPSO)
 * - Improved Ant Colony Optimization (IACO)
 * - Hybrid Heuristic (HH) Algorithm
 */

import logger from '../lib/logger';

// ==================== TYPE DEFINITIONS ====================

export interface TerminalDevice {
  id: string;
  name: string;
  transmissionPower: number;  // pir - transmission power (W)
  idlePower: number;          // pie - idle power (W)
  isMobile: boolean;          // ai - mobile flag
  delayWeight: number;        // wit - delay weight
  energyWeight: number;       // wie - energy weight
  residualEnergy: number;     // Eil - residual energy (J)
}

export interface Task {
  id: string;
  name: string;
  dataSize: number;           // Di - data size (Mb)
  computationIntensity: number; // θi - computation intensity (cycles/bit)
  maxToleranceTime: number;   // Ti,max - maximum tolerate time (s)
  expectedCompletionTime: number; // Ti,exp - expected completion time (s)
  terminalDeviceId: string;
  priority: number;
}

export interface FogNode {
  id: string;
  name: string;
  computingResource: number;  // Cj - computing resource (cycles/s)
  storageCapacity: number;    // Kj - storage capacity (GB)
  networkBandwidth: number;   // Bj - network bandwidth (Mbps)
  currentLoad: number;        // Current utilization (0-1)
}

export interface SchedulingResult {
  taskId: string;
  fogNodeId: string;
  executionTime: number;      // TEij
  transmissionTime: number;   // TRij
  totalDelay: number;         // Tij
  energyConsumption: number;  // Eij
  fitness: number;
}

export interface SchedulingSolution {
  allocations: Map<string, string>; // taskId -> fogNodeId
  totalDelay: number;
  totalEnergy: number;
  fitness: number;
  reliability: number;
}

// ==================== MATHEMATICAL MODELS ====================

/**
 * Calculate execution time of task Ii at fog node Fj
 * TEij = Di * θi / Cj
 */
function calculateExecutionTime(task: Task, fogNode: FogNode): number {
  const dataSizeBits = task.dataSize * 1e6 * 8; // Convert Mb to bits
  const totalCycles = dataSizeBits * task.computationIntensity;
  return totalCycles / fogNode.computingResource;
}

/**
 * Calculate transmission time to send task Ii to fog node Fj
 * TRij = Di / rij
 * where rij = B * log2(1 + h*p/σ) - simplified to Di / Bj
 */
function calculateTransmissionTime(task: Task, fogNode: FogNode): number {
  return task.dataSize / fogNode.networkBandwidth;
}

/**
 * Calculate total delay
 * Tij = TRij + TEij
 */
function calculateTotalDelay(task: Task, fogNode: FogNode): number {
  return calculateTransmissionTime(task, fogNode) + calculateExecutionTime(task, fogNode);
}

/**
 * Calculate energy consumption
 * Eij = TRij * pir + TEij * pie
 */
function calculateEnergyConsumption(
  task: Task,
  fogNode: FogNode,
  device: TerminalDevice
): number {
  const transmissionTime = calculateTransmissionTime(task, fogNode);
  const executionTime = calculateExecutionTime(task, fogNode);
  return transmissionTime * device.transmissionPower + executionTime * device.idlePower;
}

/**
 * Calculate objective function value
 * f = Σ(wit * Tij + wie * Eij)
 */
function calculateObjectiveFunction(
  allocations: Map<string, string>,
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): { totalDelay: number; totalEnergy: number; fitness: number } {
  let totalDelay = 0;
  let totalEnergy = 0;

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

    totalDelay += device.delayWeight * delay;
    totalEnergy += device.energyWeight * energy;
  }

  const objectiveValue = totalDelay + totalEnergy;
  const fitness = objectiveValue > 0 ? 1 / objectiveValue : Infinity;

  return { totalDelay, totalEnergy, fitness };
}

// ==================== PARTICLE SWARM OPTIMIZATION (IPSO) ====================

interface Particle {
  position: number[][]; // n x m matrix (task x fogNode)
  velocity: number[][];
  personalBest: number[][];
  personalBestFitness: number;
}

class ImprovedPSO {
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

  /**
   * Sigmoid function for binary conversion
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Calculate adaptive inertia weight
   * w = wmax - (wmax-wmin)*k/Kmax for k < 0.7*Kmax
   * w = wmin + (wmax-wmin)*rand for k >= 0.7*Kmax
   */
  private calculateInertiaWeight(iteration: number): number {
    if (iteration < 0.7 * this.maxIterations) {
      return this.wMax - ((this.wMax - this.wMin) * iteration) / this.maxIterations;
    }
    return this.wMin + (this.wMax - this.wMin) * Math.random();
  }

  /**
   * Calculate contraction factor
   * η = 2κ / |2 - φ - sqrt(φ² - 4φ)|, where φ = c1 + c2
   */
  private calculateContractionFactor(): number {
    const phi = this.c1 + this.c2;
    if (phi <= 4) return 1;
    return (2 * 1) / Math.abs(2 - phi - Math.sqrt(phi * phi - 4 * phi));
  }

  /**
   * Initialize particle swarm
   */
  private initializeParticles(): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;

    for (let p = 0; p < this.numParticles; p++) {
      const position: number[][] = [];
      const velocity: number[][] = [];

      for (let i = 0; i < n; i++) {
        const posRow: number[] = new Array(m).fill(0);
        const velRow: number[] = [];
        
        // Random allocation - exactly one fog node per task
        const selectedFog = Math.floor(Math.random() * m);
        posRow[selectedFog] = 1;
        
        for (let j = 0; j < m; j++) {
          velRow.push((Math.random() * 2 - 1) * this.vMax);
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

  /**
   * Convert position matrix to allocation map
   */
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

  /**
   * Evaluate fitness of a position
   */
  private evaluateFitness(position: number[][]): number {
    const allocations = this.positionToAllocation(position);
    const result = calculateObjectiveFunction(allocations, this.tasks, this.fogNodes, this.devices);
    return result.fitness;
  }

  /**
   * Update particle velocity and position
   */
  private updateParticle(particle: Particle, iteration: number): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;
    const w = this.calculateInertiaWeight(iteration);
    const eta = this.calculateContractionFactor();

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const r1 = Math.random();
        const r2 = Math.random();
        
        // Update velocity (Equation 7)
        particle.velocity[i][j] = eta * (
          w * particle.velocity[i][j] +
          this.c1 * r1 * (particle.personalBest[i][j] - particle.position[i][j]) +
          this.c2 * r2 * (this.globalBest[i][j] - particle.position[i][j])
        );

        // Clamp velocity
        particle.velocity[i][j] = Math.max(-this.vMax, Math.min(this.vMax, particle.velocity[i][j]));
      }
    }

    // Update position using sigmoid (Equation 9)
    for (let i = 0; i < n; i++) {
      const sigValues = particle.velocity[i].map(v => this.sigmoid(v));
      const maxIdx = sigValues.indexOf(Math.max(...sigValues));
      
      particle.position[i] = new Array(m).fill(0);
      particle.position[i][maxIdx] = 1;
    }
  }

  /**
   * Run IPSO algorithm
   */
  run(): { bestPosition: number[][]; bestFitness: number } {
    this.initializeParticles();

    // Initial evaluation
    for (const particle of this.particles) {
      const fitness = this.evaluateFitness(particle.position);
      particle.personalBestFitness = fitness;
      particle.personalBest = particle.position.map(row => [...row]);

      if (fitness > this.globalBestFitness) {
        this.globalBestFitness = fitness;
        this.globalBest = particle.position.map(row => [...row]);
      }
    }

    // Main loop
    for (let iter = 0; iter < this.maxIterations; iter++) {
      for (const particle of this.particles) {
        this.updateParticle(particle, iter);

        const fitness = this.evaluateFitness(particle.position);

        // Update personal best
        if (fitness > particle.personalBestFitness) {
          particle.personalBestFitness = fitness;
          particle.personalBest = particle.position.map(row => [...row]);
        }

        // Update global best
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

// ==================== ANT COLONY OPTIMIZATION (IACO) ====================

interface Ant {
  path: number[]; // path[i] = j means task i is assigned to fog node j
  pathLength: number;
}

class ImprovedACO {
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

  /**
   * Initialize pheromone matrix
   */
  private initializePheromone(initial?: number[][]): void {
    const n = this.tasks.length;
    const m = this.fogNodes.length;

    if (initial) {
      // Use initial pheromone from PSO
      this.pheromone = initial.map(row => row.map(v => v + 0.1));
    } else {
      this.pheromone = [];
      for (let i = 0; i < n; i++) {
        this.pheromone.push(new Array(m).fill(1.0));
      }
    }
  }

  /**
   * Calculate computational overhead (delay + energy)
   */
  private calculateOverhead(taskIdx: number, fogIdx: number): number {
    const task = this.tasks[taskIdx];
    const fogNode = this.fogNodes[fogIdx];
    const device = this.devices.find(d => d.id === task.terminalDeviceId);
    
    if (!device) return Infinity;

    const delay = calculateTotalDelay(task, fogNode);
    const energy = calculateEnergyConsumption(task, fogNode, device);
    
    return device.delayWeight * delay + device.energyWeight * energy;
  }

  /**
   * Improved heuristic information (Equation 13)
   * ηij = w1 * (1/fij) + w2 * (1/Σfvj)
   */
  private calculateHeuristic(taskIdx: number, fogIdx: number, previousOverhead: number): number {
    const currentOverhead = this.calculateOverhead(taskIdx, fogIdx);
    const w1 = 0.6;
    const w2 = 0.4;

    const localHeuristic = currentOverhead > 0 ? 1 / currentOverhead : 1;
    const globalHeuristic = previousOverhead > 0 ? 1 / previousOverhead : 1;

    return w1 * localHeuristic + w2 * globalHeuristic;
  }

  /**
   * Regulatory factor for path transition probability (Equation 15)
   * μij = e^(-|τij - τ̄|)
   */
  private calculateRegulatoryFactor(taskIdx: number, fogIdx: number): number {
    const avgPheromone = this.pheromone[taskIdx].reduce((a, b) => a + b, 0) / this.fogNodes.length;
    return Math.exp(-Math.abs(this.pheromone[taskIdx][fogIdx] - avgPheromone));
  }

  /**
   * Calculate path transition probability (Equation 14)
   */
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

    // Normalize
    return probabilities.map(p => p / sum);
  }

  /**
   * Select next fog node using roulette wheel
   */
  private selectFogNode(probabilities: number[]): number {
    const rand = Math.random();
    let cumulative = 0;

    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j];
      if (rand <= cumulative) {
        return j;
      }
    }

    return probabilities.length - 1;
  }

  /**
   * Construct solution for one ant
   */
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

  /**
   * Update local pheromone (Equations 16-17)
   */
  private updateLocalPheromone(ant: Ant): void {
    for (let i = 0; i < this.tasks.length; i++) {
      const j = ant.path[i];
      const overhead = this.calculateOverhead(i, j);
      const deltaTau = overhead > 0 ? this.Q / overhead : 0;
      
      this.pheromone[i][j] = (1 - this.rho) * this.pheromone[i][j] + deltaTau;
    }
  }

  /**
   * Update global pheromone (Equations 18-19)
   */
  private updateGlobalPheromone(ants: Ant[]): void {
    // Evaporate
    for (let i = 0; i < this.tasks.length; i++) {
      for (let j = 0; j < this.fogNodes.length; j++) {
        this.pheromone[i][j] *= (1 - this.rho);
      }
    }

    // Deposit pheromone from all ants
    for (const ant of ants) {
      const deltaTau = ant.pathLength > 0 ? this.Q / ant.pathLength : 0;
      for (let i = 0; i < this.tasks.length; i++) {
        const j = ant.path[i];
        this.pheromone[i][j] += deltaTau;
      }
    }
  }

  /**
   * Run IACO algorithm
   */
  run(): { bestPath: number[]; bestPathLength: number } {
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const ants: Ant[] = [];

      // Construct solutions for all ants
      for (let k = 0; k < this.numAnts; k++) {
        const ant = this.constructSolution();
        ants.push(ant);

        // Update local pheromone
        this.updateLocalPheromone(ant);

        // Track best solution
        if (ant.pathLength < this.bestPathLength) {
          this.bestPathLength = ant.pathLength;
          this.bestPath = [...ant.path];
        }
      }

      // Update global pheromone
      this.updateGlobalPheromone(ants);
    }

    return {
      bestPath: this.bestPath,
      bestPathLength: this.bestPathLength
    };
  }
}

// ==================== HYBRID HEURISTIC (HH) ALGORITHM ====================

export class HybridHeuristicScheduler {
  constructor(
    private tasks: Task[],
    private fogNodes: FogNode[],
    private devices: TerminalDevice[]
  ) {}

  /**
   * Run the Hybrid Heuristic algorithm
   * Step 1: Run IPSO to get initial solution
   * Step 2: Use IPSO result to initialize IACO pheromone
   * Step 3: Run IACO for final optimization
   */
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

      if (delay <= task.maxToleranceTime && energy <= device.residualEnergy) {
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

  /**
   * Get detailed scheduling results
   */
  getDetailedResults(solution: SchedulingSolution): SchedulingResult[] {
    const results: SchedulingResult[] = [];

    for (const task of this.tasks) {
      const fogNodeId = solution.allocations.get(task.id);
      if (!fogNodeId) continue;

      const fogNode = this.fogNodes.find(f => f.id === fogNodeId);
      const device = this.devices.find(d => d.id === task.terminalDeviceId);
      if (!fogNode || !device) continue;

      const executionTime = calculateExecutionTime(task, fogNode);
      const transmissionTime = calculateTransmissionTime(task, fogNode);
      const totalDelay = executionTime + transmissionTime;
      const energyConsumption = calculateEnergyConsumption(task, fogNode, device);

      results.push({
        taskId: task.id,
        fogNodeId: fogNode.id,
        executionTime,
        transmissionTime,
        totalDelay,
        energyConsumption,
        fitness: totalDelay > 0 ? 1 / (device.delayWeight * totalDelay + device.energyWeight * energyConsumption) : 0
      });
    }

    return results;
  }
}

// ==================== STANDALONE ALGORITHMS FOR COMPARISON ====================

/**
 * IPSO-Only Scheduling - For comparison
 * Uses only Improved Particle Swarm Optimization without ACO refinement
 */
export function ipsoOnlySchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const ipso = new ImprovedPSO(tasks, fogNodes, devices, 30, 100);
  const psoResult = ipso.run();
  
  // Convert PSO result to allocation map
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
  
  // Calculate reliability
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

/**
 * IACO-Only Scheduling - For comparison
 * Uses only Improved Ant Colony Optimization without PSO initialization
 */
export function iacoOnlySchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const iaco = new ImprovedACO(tasks, fogNodes, devices, 30, 100);
  const acoResult = iaco.run();
  
  // Convert ACO result to allocation map
  const allocations = new Map<string, string>();
  for (let i = 0; i < tasks.length; i++) {
    allocations.set(tasks[i].id, fogNodes[acoResult.bestPath[i]].id);
  }
  
  const result = calculateObjectiveFunction(allocations, tasks, fogNodes, devices);
  
  // Calculate reliability
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

// ==================== COMPARISON ALGORITHMS ====================

/**
 * First-Come-First-Served (FCFS) Scheduling - For comparison
 * Tasks are processed in arrival order, assigned to the first available fog node
 */
export function fcfsSchedule(
  tasks: Task[],
  fogNodes: FogNode[],
  devices: TerminalDevice[]
): SchedulingSolution {
  const allocations = new Map<string, string>();
  const fogNodeLoads = new Map<string, number>();
  fogNodes.forEach(f => fogNodeLoads.set(f.id, f.currentLoad));

  // Process tasks in order (FCFS - first come first served)
  for (const task of tasks) {
    // Find first available fog node (lowest current load)
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
    
    // Update simulated load
    const delay = calculateTotalDelay(task, bestFogNode);
    fogNodeLoads.set(bestFogNode.id, (fogNodeLoads.get(bestFogNode.id) || 0) + delay * 0.1);
  }

  const result = calculateObjectiveFunction(allocations, tasks, fogNodes, devices);

  // Calculate reliability
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

/**
 * Round-Robin (RR) Scheduling - For comparison
 */
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
  
  // Calculate reliability
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

/**
 * Min-Min Scheduling - For comparison
 */
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

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate sample terminal devices
 */
export function generateSampleDevices(count: number): TerminalDevice[] {
  const devices: TerminalDevice[] = [];
  
  for (let i = 0; i < count; i++) {
    const isMobile = Math.random() > 0.5;
    devices.push({
      id: `device-${i + 1}`,
      name: `Terminal-${i + 1}`,
      transmissionPower: 0.1, // 0.1W
      idlePower: 0.05, // 0.05W
      isMobile,
      delayWeight: isMobile ? 0.7 : 1.0,
      energyWeight: isMobile ? 0.3 : 0.0,
      residualEnergy: isMobile ? 1000 + Math.random() * 500 : Infinity // Joules
    });
  }
  
  return devices;
}

/**
 * Generate sample tasks
 */
export function generateSampleTasks(count: number, devices: TerminalDevice[]): Task[] {
  const tasks: Task[] = [];
  const taskTypes = ['DETECTION', 'SCHEDULING', 'MONITORING', 'ANALYSIS', 'STORAGE'];
  
  for (let i = 0; i < count; i++) {
    const dataSize = 10 + Math.random() * 40; // 10-50 Mb
    tasks.push({
      id: `task-${i + 1}`,
      name: `${taskTypes[i % taskTypes.length]}-${i + 1}`,
      dataSize,
      computationIntensity: 200 + Math.random() * 200, // 200-400 cycles/bit
      maxToleranceTime: 5 + Math.random() * 45, // 5-50 seconds
      expectedCompletionTime: 2 + Math.random() * 8, // 2-10 seconds
      terminalDeviceId: devices[i % devices.length].id,
      priority: Math.floor(Math.random() * 5) + 1 // 1-5
    });
  }
  
  return tasks;
}

/**
 * Generate sample fog nodes
 */
export function generateSampleFogNodes(count: number): FogNode[] {
  const fogNodes: FogNode[] = [];
  
  for (let i = 0; i < count; i++) {
    fogNodes.push({
      id: `fog-${i + 1}`,
      name: `FogNode-${i + 1}`,
      computingResource: (1 + Math.random()) * 1e9, // 1-2 GHz
      storageCapacity: 50 + Math.random() * 150, // 50-200 GB
      networkBandwidth: 50 + Math.random() * 50, // 50-100 Mbps
      currentLoad: Math.random() * 0.5 // 0-50% initial load
    });
  }
  
  return fogNodes;
}

/**
 * Run comparison between all algorithms
 */
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

  // Run HH
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

export default HybridHeuristicScheduler;
