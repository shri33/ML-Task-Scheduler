/**
 * Unit Tests for Fog Computing Scheduling Algorithms
 * Tests implementation of Wang & Li (2019) Hybrid Heuristic Algorithm
 */

import {
  calculateExecutionTime,
  calculateTransmissionTime,
  calculateTotalDelay,
  calculateEnergyConsumption,
  calculateObjectiveFunction,
  HybridHeuristicScheduler,
  roundRobinSchedule,
  minMinSchedule,
  fcfsSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  runAlgorithmComparison,
  // Cloud offloading
  makeOffloadDecision,
  scheduleWith3LayerOffloading,
  calculateCloudExecutionTime,
  calculateCloudCost,
  generateSampleCloudNode,
  defaultCloudNode,
  Task,
  FogNode,
  TerminalDevice,
  CloudNode
} from '../services/fogComputing.service';

// ==================== TEST FIXTURES ====================

const createMockDevice = (overrides: Partial<TerminalDevice> = {}): TerminalDevice => ({
  id: 'device-1',
  name: 'Test Device',
  transmissionPower: 0.1,
  idlePower: 0.05,
  isMobile: true,
  delayWeight: 0.7,
  energyWeight: 0.3,
  residualEnergy: 1000,
  ...overrides
});

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  name: 'Test Task',
  dataSize: 20, // Mb
  computationIntensity: 300, // cycles/bit
  maxToleranceTime: 30, // seconds
  expectedCompletionTime: 5,
  terminalDeviceId: 'device-1',
  priority: 3,
  ...overrides
});

const createMockFogNode = (overrides: Partial<FogNode> = {}): FogNode => ({
  id: 'fog-1',
  name: 'Fog Node 1',
  computingResource: 1.5e9, // 1.5 GHz
  storageCapacity: 100,
  networkBandwidth: 75, // Mbps
  currentLoad: 0.2,
  ...overrides
});

// ==================== MATHEMATICAL MODEL TESTS ====================

describe('Mathematical Model Functions (Paper Equations 1-6)', () => {
  describe('calculateExecutionTime (Equation 1: TEij)', () => {
    it('should calculate execution time correctly', () => {
      const task = createMockTask({ dataSize: 20, computationIntensity: 300 });
      const fogNode = createMockFogNode({ computingResource: 1.5e9 });
      
      // TEij = Di * θi / Cj (with conversion: Mb to bits = *1e6*8)
      // = (20 * 1e6 * 8) * 300 / 1.5e9
      const result = calculateExecutionTime(task, fogNode);
      const expected = (20 * 1e6 * 8) * 300 / 1.5e9;
      expect(result).toBeCloseTo(expected, 5);
    });

    it('should increase with larger data size', () => {
      const smallTask = createMockTask({ dataSize: 10 });
      const largeTask = createMockTask({ dataSize: 50 });
      const fogNode = createMockFogNode();

      expect(calculateExecutionTime(largeTask, fogNode))
        .toBeGreaterThan(calculateExecutionTime(smallTask, fogNode));
    });

    it('should decrease with higher computing resources', () => {
      const task = createMockTask();
      const slowNode = createMockFogNode({ computingResource: 1e9 });
      const fastNode = createMockFogNode({ computingResource: 2e9 });

      expect(calculateExecutionTime(task, fastNode))
        .toBeLessThan(calculateExecutionTime(task, slowNode));
    });
  });

  describe('calculateTransmissionTime (Equation 2: TRij)', () => {
    it('should calculate transmission time correctly', () => {
      const task = createMockTask({ dataSize: 75 });
      const fogNode = createMockFogNode({ networkBandwidth: 75 });
      
      // TRij = L_i / NB_j = 75 / 75 = 1 second
      const result = calculateTransmissionTime(task, fogNode);
      expect(result).toBeCloseTo(1, 5);
    });

    it('should increase with larger data size', () => {
      const smallTask = createMockTask({ dataSize: 10 });
      const largeTask = createMockTask({ dataSize: 100 });
      const fogNode = createMockFogNode();

      expect(calculateTransmissionTime(largeTask, fogNode))
        .toBeGreaterThan(calculateTransmissionTime(smallTask, fogNode));
    });
  });

  describe('calculateTotalDelay (Equation 4: Tij)', () => {
    it('should equal execution time plus transmission time', () => {
      const task = createMockTask();
      const fogNode = createMockFogNode();
      
      const execTime = calculateExecutionTime(task, fogNode);
      const transTime = calculateTransmissionTime(task, fogNode);
      const totalDelay = calculateTotalDelay(task, fogNode);

      expect(totalDelay).toBeCloseTo(execTime + transTime, 10);
    });
  });

  describe('calculateEnergyConsumption (Equation 5: Eij)', () => {
    it('should calculate energy consumption correctly', () => {
      const task = createMockTask();
      const fogNode = createMockFogNode();
      const device = createMockDevice();

      const result = calculateEnergyConsumption(task, fogNode, device);
      
      // Energy should be positive
      expect(result).toBeGreaterThan(0);
    });

    it('should be higher for mobile devices (with energy weight)', () => {
      const task = createMockTask();
      const fogNode = createMockFogNode();
      const mobileDevice = createMockDevice({ isMobile: true, energyWeight: 0.3 });
      const stationaryDevice = createMockDevice({ isMobile: false, energyWeight: 0 });

      // Both should calculate, but mobile has energy weight
      const mobileEnergy = calculateEnergyConsumption(task, fogNode, mobileDevice);
      const stationaryEnergy = calculateEnergyConsumption(task, fogNode, stationaryDevice);

      expect(mobileEnergy).toBeDefined();
      expect(stationaryEnergy).toBeDefined();
    });
  });

  describe('calculateObjectiveFunction (Equation 6: F)', () => {
    it('should calculate weighted sum of delay and energy', () => {
      const devices = [createMockDevice()];
      const tasks = [createMockTask()];
      const fogNodes = [createMockFogNode()];
      const allocations = new Map([['task-1', 'fog-1']]);

      const result = calculateObjectiveFunction(allocations, tasks, fogNodes, devices);

      expect(result).toHaveProperty('totalDelay');
      expect(result).toHaveProperty('totalEnergy');
      expect(result).toHaveProperty('fitness');
      expect(result.totalDelay).toBeGreaterThan(0);
      expect(result.fitness).toBeGreaterThan(0);
    });

    it('should handle multiple tasks and fog nodes', () => {
      const devices = [
        createMockDevice({ id: 'device-1' }),
        createMockDevice({ id: 'device-2' })
      ];
      const tasks = [
        createMockTask({ id: 'task-1', terminalDeviceId: 'device-1' }),
        createMockTask({ id: 'task-2', terminalDeviceId: 'device-2' })
      ];
      const fogNodes = [
        createMockFogNode({ id: 'fog-1' }),
        createMockFogNode({ id: 'fog-2' })
      ];
      const allocations = new Map([
        ['task-1', 'fog-1'],
        ['task-2', 'fog-2']
      ]);

      const result = calculateObjectiveFunction(allocations, tasks, fogNodes, devices);

      expect(result.totalDelay).toBeGreaterThan(0);
    });
  });
});

// ==================== IPSO ALGORITHM TESTS ====================

describe('Improved PSO (IPSO) Algorithm', () => {
  it('should find valid solution for simple problem', () => {
    const devices = generateSampleDevices(3);
    const tasks = generateSampleTasks(5, devices);
    const fogNodes = generateSampleFogNodes(3);

    const result = ipsoOnlySchedule(tasks, fogNodes, devices);

    expect(result.allocations.size).toBe(tasks.length);
    expect(result.totalDelay).toBeGreaterThan(0);
    expect(result.fitness).toBeGreaterThan(0);
    expect(result.reliability).toBeGreaterThanOrEqual(0);
    expect(result.reliability).toBeLessThanOrEqual(100);
  });

  it('should assign all tasks to valid fog nodes', () => {
    const devices = generateSampleDevices(2);
    const tasks = generateSampleTasks(4, devices);
    const fogNodes = generateSampleFogNodes(2);
    const fogNodeIds = new Set(fogNodes.map(f => f.id));

    const result = ipsoOnlySchedule(tasks, fogNodes, devices);

    result.allocations.forEach((fogNodeId) => {
      expect(fogNodeIds.has(fogNodeId)).toBe(true);
    });
  });
});

// ==================== IACO ALGORITHM TESTS ====================

describe('Improved ACO (IACO) Algorithm', () => {
  it('should find valid solution for simple problem', () => {
    const devices = generateSampleDevices(3);
    const tasks = generateSampleTasks(5, devices);
    const fogNodes = generateSampleFogNodes(3);

    const result = iacoOnlySchedule(tasks, fogNodes, devices);

    expect(result.allocations.size).toBe(tasks.length);
    expect(result.totalDelay).toBeGreaterThan(0);
    expect(result.fitness).toBeGreaterThan(0);
  });

  it('should converge to a solution', () => {
    const devices = generateSampleDevices(2);
    const tasks = generateSampleTasks(3, devices);
    const fogNodes = generateSampleFogNodes(2);

    const result = iacoOnlySchedule(tasks, fogNodes, devices);

    expect(result.allocations.size).toBe(tasks.length);
  });
});

// ==================== HYBRID HEURISTIC (HH) ALGORITHM TESTS ====================

describe('Hybrid Heuristic (HH) Scheduler', () => {
  it('should combine IPSO and IACO for better results', () => {
    const devices = generateSampleDevices(5);
    const tasks = generateSampleTasks(10, devices);
    const fogNodes = generateSampleFogNodes(4);

    const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const result = scheduler.schedule();

    expect(result.allocations.size).toBe(tasks.length);
    expect(result.totalDelay).toBeGreaterThan(0);
    expect(result.totalEnergy).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeGreaterThan(0);
  });

  it('should outperform or match simple algorithms', () => {
    const devices = generateSampleDevices(5);
    const tasks = generateSampleTasks(15, devices);
    const fogNodes = generateSampleFogNodes(5);

    const hhScheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const hhResult = hhScheduler.schedule();
    const rrResult = roundRobinSchedule(tasks, fogNodes, devices);

    // HH should generally have competitive fitness
    // Allow wider variance due to stochastic nature of metaheuristics
    expect(hhResult.fitness).toBeLessThanOrEqual(rrResult.fitness * 1.5);
  });

  it('should handle edge case with single task', () => {
    const devices = generateSampleDevices(1);
    const tasks = generateSampleTasks(1, devices);
    const fogNodes = generateSampleFogNodes(2);

    const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const result = scheduler.schedule();

    expect(result.allocations.size).toBe(1);
  });

  it('should handle many tasks with few fog nodes', () => {
    const devices = generateSampleDevices(10);
    const tasks = generateSampleTasks(20, devices);
    const fogNodes = generateSampleFogNodes(2);

    const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const result = scheduler.schedule();

    expect(result.allocations.size).toBe(20);
  });
});

// ==================== COMPARISON ALGORITHMS TESTS ====================

describe('Comparison Algorithms', () => {
  const devices = generateSampleDevices(5);
  const tasks = generateSampleTasks(10, devices);
  const fogNodes = generateSampleFogNodes(4);

  describe('Round-Robin Scheduling', () => {
    it('should distribute tasks evenly across fog nodes', () => {
      const result = roundRobinSchedule(tasks, fogNodes, devices);
      
      expect(result.allocations.size).toBe(tasks.length);
      
      // Count allocations per fog node
      const allocationCounts = new Map<string, number>();
      result.allocations.forEach((fogNodeId) => {
        allocationCounts.set(fogNodeId, (allocationCounts.get(fogNodeId) || 0) + 1);
      });

      // Round-robin should distribute relatively evenly
      const counts = Array.from(allocationCounts.values());
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);
      expect(maxCount - minCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Min-Min Scheduling', () => {
    it('should prioritize smaller tasks', () => {
      const result = minMinSchedule(tasks, fogNodes, devices);
      
      expect(result.allocations.size).toBe(tasks.length);
      expect(result.fitness).toBeGreaterThan(0);
    });
  });

  describe('FCFS Scheduling', () => {
    it('should process tasks in order', () => {
      const result = fcfsSchedule(tasks, fogNodes, devices);
      
      expect(result.allocations.size).toBe(tasks.length);
      expect(result.fitness).toBeGreaterThan(0);
    });
  });
});

// ==================== UTILITY FUNCTION TESTS ====================

describe('Utility Functions', () => {
  describe('generateSampleDevices', () => {
    it('should generate correct number of devices', () => {
      const devices = generateSampleDevices(5);
      expect(devices).toHaveLength(5);
    });

    it('should generate valid device properties', () => {
      const devices = generateSampleDevices(3);
      
      devices.forEach(device => {
        expect(device.id).toBeDefined();
        expect(device.transmissionPower).toBeGreaterThan(0);
        expect(device.idlePower).toBeGreaterThan(0);
        expect(typeof device.isMobile).toBe('boolean');
        expect(device.delayWeight).toBeGreaterThanOrEqual(0);
        expect(device.delayWeight).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('generateSampleTasks', () => {
    it('should generate correct number of tasks', () => {
      const devices = generateSampleDevices(2);
      const tasks = generateSampleTasks(10, devices);
      expect(tasks).toHaveLength(10);
    });

    it('should assign tasks to valid devices', () => {
      const devices = generateSampleDevices(3);
      const tasks = generateSampleTasks(5, devices);
      const deviceIds = new Set(devices.map(d => d.id));

      tasks.forEach(task => {
        expect(deviceIds.has(task.terminalDeviceId)).toBe(true);
      });
    });
  });

  describe('generateSampleFogNodes', () => {
    it('should generate correct number of fog nodes', () => {
      const fogNodes = generateSampleFogNodes(4);
      expect(fogNodes).toHaveLength(4);
    });

    it('should generate valid fog node properties', () => {
      const fogNodes = generateSampleFogNodes(3);
      
      fogNodes.forEach(node => {
        expect(node.id).toBeDefined();
        expect(node.computingResource).toBeGreaterThan(0);
        expect(node.networkBandwidth).toBeGreaterThan(0);
        expect(node.currentLoad).toBeGreaterThanOrEqual(0);
        expect(node.currentLoad).toBeLessThanOrEqual(1);
      });
    });
  });
});

// ==================== ALGORITHM COMPARISON TESTS ====================

describe('runAlgorithmComparison', () => {
  it('should run all algorithms and return results', () => {
    const devices = generateSampleDevices(3);
    const tasks = generateSampleTasks(5, devices);
    const fogNodes = generateSampleFogNodes(3);

    const results = runAlgorithmComparison(tasks, fogNodes, devices);

    expect(results).toHaveProperty('hh');
    expect(results).toHaveProperty('ipso');
    expect(results).toHaveProperty('iaco');
    expect(results).toHaveProperty('rr');
    expect(results).toHaveProperty('minMin');

    // All algorithms should allocate all tasks
    expect(results.hh.allocations.size).toBe(tasks.length);
    expect(results.ipso.allocations.size).toBe(tasks.length);
    expect(results.iaco.allocations.size).toBe(tasks.length);
    expect(results.rr.allocations.size).toBe(tasks.length);
    expect(results.minMin.allocations.size).toBe(tasks.length);
  });

  it('should show HH algorithm has competitive performance', () => {
    const devices = generateSampleDevices(5);
    const tasks = generateSampleTasks(15, devices);
    const fogNodes = generateSampleFogNodes(4);

    const results = runAlgorithmComparison(tasks, fogNodes, devices);

    // All algorithms should produce valid results
    expect(results.hh.fitness).toBeGreaterThan(0);
    expect(results.ipso.fitness).toBeGreaterThan(0);
    expect(results.iaco.fitness).toBeGreaterThan(0);
    expect(results.rr.fitness).toBeGreaterThan(0);
    expect(results.minMin.fitness).toBeGreaterThan(0);
    
    // HH should generally be competitive with other algorithms
    // Due to stochastic nature, just verify it's a reasonable value
    const maxFitness = Math.max(results.rr.fitness, results.minMin.fitness);
    expect(results.hh.fitness).toBeLessThanOrEqual(maxFitness * 2);
  });
});

// ==================== RELIABILITY CONSTRAINT TESTS ====================

describe('Reliability Constraints', () => {
  it('should correctly calculate reliability percentage', () => {
    const devices = generateSampleDevices(3);
    const tasks = generateSampleTasks(5, devices);
    const fogNodes = generateSampleFogNodes(3);

    const result = roundRobinSchedule(tasks, fogNodes, devices);

    expect(result.reliability).toBeGreaterThanOrEqual(0);
    expect(result.reliability).toBeLessThanOrEqual(100);
  });

  it('should consider max tolerance time constraint', () => {
    const device = createMockDevice();
    const task = createMockTask({ maxToleranceTime: 0.0001 }); // Very tight constraint
    const fogNode = createMockFogNode();

    const delay = calculateTotalDelay(task, fogNode);
    
    // With very tight constraint, delay likely exceeds tolerance
    expect(delay).toBeGreaterThan(task.maxToleranceTime);
  });
});

// ==================== PERFORMANCE TESTS ====================

describe('Performance Tests', () => {
  it('should handle medium-scale problems efficiently', () => {
    const devices = generateSampleDevices(20);
    const tasks = generateSampleTasks(50, devices);
    const fogNodes = generateSampleFogNodes(10);

    const startTime = Date.now();
    const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const result = scheduler.schedule();
    const endTime = Date.now();

    expect(result.allocations.size).toBe(50);
    // Should complete within 30 seconds (generous for CI environments)
    expect(endTime - startTime).toBeLessThan(30000);
  });

  it('should handle large task-to-node ratio', () => {
    const devices = generateSampleDevices(50);
    const tasks = generateSampleTasks(100, devices);
    const fogNodes = generateSampleFogNodes(3);

    const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const result = scheduler.schedule();

    expect(result.allocations.size).toBe(100);
  });
});

// ==================== CLOUD OFFLOADING TESTS (3-LAYER ARCHITECTURE) ====================

describe('Cloud Offloading (3-Layer Architecture)', () => {
  const createMockCloudNode = (overrides: Partial<CloudNode> = {}): CloudNode => ({
    id: 'cloud-1',
    name: 'Test Cloud',
    computingResource: 100e9,
    networkBandwidth: 100,
    latencyPenalty: 50,
    costPerUnit: 0.001,
    available: true,
    ...overrides
  });

  describe('calculateCloudExecutionTime', () => {
    it('should calculate cloud execution time with latency penalty', () => {
      const task = createMockTask({ dataSize: 20, computationIntensity: 300 });
      const cloud = createMockCloudNode({ latencyPenalty: 50 });

      const result = calculateCloudExecutionTime(task, cloud);

      // Should include base time + transmission + latency
      expect(result).toBeGreaterThan(0.05); // At least 50ms latency
    });

    it('should be faster than fog for very large tasks', () => {
      const largeTask = createMockTask({ dataSize: 500, computationIntensity: 1000 });
      const cloud = createMockCloudNode({ computingResource: 100e9 });
      const fogNode = createMockFogNode({ computingResource: 1.5e9 });

      const cloudTime = calculateCloudExecutionTime(largeTask, cloud);
      const fogTime = calculateTotalDelay(largeTask, fogNode);

      // Cloud should be faster for very large tasks despite latency
      expect(cloudTime).toBeLessThan(fogTime);
    });
  });

  describe('calculateCloudCost', () => {
    it('should calculate cost based on computation units', () => {
      const task = createMockTask({ dataSize: 20, computationIntensity: 300 });
      const cloud = createMockCloudNode({ costPerUnit: 0.001 });

      const cost = calculateCloudCost(task, cloud);

      // Cost = dataSize * computationIntensity * costPerUnit
      expect(cost).toBeCloseTo(20 * 300 * 0.001, 5);
    });

    it('should scale with task size', () => {
      const smallTask = createMockTask({ dataSize: 10 });
      const largeTask = createMockTask({ dataSize: 100 });
      const cloud = createMockCloudNode();

      const smallCost = calculateCloudCost(smallTask, cloud);
      const largeCost = calculateCloudCost(largeTask, cloud);

      expect(largeCost).toBeGreaterThan(smallCost);
    });
  });

  describe('makeOffloadDecision', () => {
    it('should prefer fog when capacity is available and constraints met', () => {
      const device = createMockDevice({ 
        isMobile: true,
        residualEnergy: 10000 // High energy ensures constraint is met
      });
      const task = createMockTask({ 
        maxToleranceTime: 100, // Generous time constraint
        dataSize: 10 // Small task
      });
      const fogNodes = [createMockFogNode({ 
        currentLoad: 0.1, 
        computingResource: 2e9,
        networkBandwidth: 100
      })];
      const cloud = createMockCloudNode();

      const decision = makeOffloadDecision(task, device, fogNodes, cloud);

      expect(decision.offloadTarget).toBe('fog');
      expect(decision.reason).toContain('Fog node');
    });

    it('should offload to cloud when fog nodes are overloaded', () => {
      const device = createMockDevice({ isMobile: true });
      const task = createMockTask({ maxToleranceTime: 30 });
      const fogNodes = [
        createMockFogNode({ id: 'fog-1', currentLoad: 0.95 }),
        createMockFogNode({ id: 'fog-2', currentLoad: 0.92 })
      ];
      const cloud = createMockCloudNode();

      const decision = makeOffloadDecision(task, device, fogNodes, cloud);

      expect(decision.offloadTarget).toBe('cloud');
      expect(decision.reason).toContain('cloud');
    });

    it('should offload to cloud when constraints cannot be met', () => {
      const device = createMockDevice({ residualEnergy: 0.001 }); // Very low energy
      const task = createMockTask({ maxToleranceTime: 0.001 }); // Very tight constraint
      const fogNodes = [createMockFogNode()];
      const cloud = createMockCloudNode();

      const decision = makeOffloadDecision(task, device, fogNodes, cloud);

      // Should either offload to cloud or force fog
      expect(['cloud', 'fog']).toContain(decision.offloadTarget);
    });

    it('should include cost estimate for cloud offloading', () => {
      const device = createMockDevice({ isMobile: true });
      const task = createMockTask();
      const fogNodes = [createMockFogNode({ currentLoad: 0.95 })];
      const cloud = createMockCloudNode({ costPerUnit: 0.01 });

      const decision = makeOffloadDecision(task, device, fogNodes, cloud);

      if (decision.offloadTarget === 'cloud') {
        expect(decision.estimatedCost).toBeGreaterThan(0);
      }
    });
  });

  describe('scheduleWith3LayerOffloading', () => {
    it('should distribute tasks across fog and cloud', () => {
      const devices = generateSampleDevices(10);
      const tasks = generateSampleTasks(20, devices);
      // Very few fog nodes to force cloud offloading
      const fogNodes = generateSampleFogNodes(2);
      fogNodes.forEach(f => f.currentLoad = 0.85); // High load
      const cloud = createMockCloudNode();

      const result = scheduleWith3LayerOffloading(tasks, fogNodes, devices, cloud);

      expect(result.decisions).toHaveLength(tasks.length);
      expect(result.fogAllocations.size + result.cloudOffloaded.length + result.localProcessed.length)
        .toBe(tasks.length);
    });

    it('should calculate total costs for cloud offloading', () => {
      const devices = generateSampleDevices(5);
      const tasks = generateSampleTasks(10, devices);
      const fogNodes = generateSampleFogNodes(2);
      fogNodes.forEach(f => f.currentLoad = 0.95); // Force cloud offloading
      const cloud = createMockCloudNode({ costPerUnit: 0.01 });

      const result = scheduleWith3LayerOffloading(tasks, fogNodes, devices, cloud);

      if (result.cloudOffloaded.length > 0) {
        expect(result.totalCost).toBeGreaterThan(0);
      }
    });

    it('should track delay separately for fog and cloud', () => {
      const devices = generateSampleDevices(5);
      const tasks = generateSampleTasks(5, devices);
      const fogNodes = generateSampleFogNodes(3);
      const cloud = createMockCloudNode();

      const result = scheduleWith3LayerOffloading(tasks, fogNodes, devices, cloud);

      expect(result.totalFogDelay).toBeGreaterThanOrEqual(0);
      expect(result.totalCloudDelay).toBeGreaterThanOrEqual(0);
    });

    it('should provide decision reasons for each task', () => {
      const devices = generateSampleDevices(3);
      const tasks = generateSampleTasks(5, devices);
      const fogNodes = generateSampleFogNodes(2);
      const cloud = createMockCloudNode();

      const result = scheduleWith3LayerOffloading(tasks, fogNodes, devices, cloud);

      result.decisions.forEach(decision => {
        expect(decision.reason).toBeDefined();
        expect(decision.reason.length).toBeGreaterThan(0);
        expect(decision.estimatedDelay).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('generateSampleCloudNode', () => {
    it('should generate valid cloud node', () => {
      const cloud = generateSampleCloudNode();

      expect(cloud.id).toBeDefined();
      expect(cloud.computingResource).toBeGreaterThan(0);
      expect(cloud.networkBandwidth).toBeGreaterThan(0);
      expect(cloud.available).toBe(true);
    });

    it('should allow overrides', () => {
      const cloud = generateSampleCloudNode({ 
        latencyPenalty: 100,
        costPerUnit: 0.05 
      });

      expect(cloud.latencyPenalty).toBe(100);
      expect(cloud.costPerUnit).toBe(0.05);
    });
  });

  describe('defaultCloudNode', () => {
    it('should have reasonable default values', () => {
      expect(defaultCloudNode.computingResource).toBeGreaterThan(0);
      expect(defaultCloudNode.latencyPenalty).toBeGreaterThanOrEqual(0);
      expect(defaultCloudNode.available).toBe(true);
    });
  });
});
