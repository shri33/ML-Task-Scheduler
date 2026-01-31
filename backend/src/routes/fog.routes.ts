import { Router, Request, Response } from 'express';
import {
  HybridHeuristicScheduler,
  fcfsSchedule,
  roundRobinSchedule,
  minMinSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  runAlgorithmComparison,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';

const router = Router();

// In-memory storage for fog computing entities
let fogNodes: FogNode[] = [];
let terminalDevices: TerminalDevice[] = [];
let fogTasks: Task[] = [];

// Initialize with sample data
function initializeSampleData() {
  if (fogNodes.length === 0) {
    fogNodes = generateSampleFogNodes(10);
    terminalDevices = generateSampleDevices(20);
    fogTasks = generateSampleTasks(50, terminalDevices);
  }
}

/**
 * @route GET /api/fog/info
 * @desc Get fog computing system information
 */
router.get('/info', (req: Request, res: Response) => {
  initializeSampleData();
  
  res.json({
    success: true,
    data: {
      description: 'Fog Computing Task Scheduling System',
      algorithm: 'Hybrid Heuristic (HH) - IPSO + IACO',
      reference: 'Wang & Li (2019) - Task Scheduling Based on Hybrid Heuristic Algorithm',
      capabilities: {
        algorithms: ['Hybrid Heuristic (HH)', 'Improved PSO (IPSO)', 'Improved ACO (IACO)', 'FCFS', 'Round-Robin', 'Min-Min'],
        metrics: ['Completion Time', 'Energy Consumption', 'Reliability'],
        features: ['Multi-objective optimization', 'Delay constraints', 'Energy constraints', 'Maximum tolerance time analysis']
      },
      currentState: {
        fogNodes: fogNodes.length,
        terminalDevices: terminalDevices.length,
        pendingTasks: fogTasks.length
      }
    }
  });
});

/**
 * @route GET /api/fog/nodes
 * @desc Get all fog nodes
 */
router.get('/nodes', (req: Request, res: Response) => {
  initializeSampleData();
  
  res.json({
    success: true,
    data: fogNodes.map(node => ({
      ...node,
      computingResourceGHz: (node.computingResource / 1e9).toFixed(2),
      networkBandwidthMbps: node.networkBandwidth.toFixed(2),
      currentLoadPercent: (node.currentLoad * 100).toFixed(1)
    }))
  });
});

/**
 * @route POST /api/fog/nodes
 * @desc Add a new fog node
 */
router.post('/nodes', (req: Request, res: Response) => {
  const { name, computingResourceGHz, storageCapacity, networkBandwidthMbps } = req.body;
  
  const newNode: FogNode = {
    id: `fog-${Date.now()}`,
    name: name || `FogNode-${fogNodes.length + 1}`,
    computingResource: (computingResourceGHz || 1.5) * 1e9,
    storageCapacity: storageCapacity || 100,
    networkBandwidth: networkBandwidthMbps || 75,
    currentLoad: 0
  };
  
  fogNodes.push(newNode);
  
  res.status(201).json({
    success: true,
    data: newNode
  });
});

/**
 * @route GET /api/fog/devices
 * @desc Get all terminal devices
 */
router.get('/devices', (req: Request, res: Response) => {
  initializeSampleData();
  
  res.json({
    success: true,
    data: terminalDevices
  });
});

/**
 * @route POST /api/fog/devices
 * @desc Add a new terminal device
 */
router.post('/devices', (req: Request, res: Response) => {
  const { name, isMobile, transmissionPower, idlePower, residualEnergy } = req.body;
  
  const mobile = isMobile ?? Math.random() > 0.5;
  
  const newDevice: TerminalDevice = {
    id: `device-${Date.now()}`,
    name: name || `Terminal-${terminalDevices.length + 1}`,
    transmissionPower: transmissionPower || 0.1,
    idlePower: idlePower || 0.05,
    isMobile: mobile,
    delayWeight: mobile ? 0.7 : 1.0,
    energyWeight: mobile ? 0.3 : 0.0,
    residualEnergy: residualEnergy || (mobile ? 1000 : Infinity)
  };
  
  terminalDevices.push(newDevice);
  
  res.status(201).json({
    success: true,
    data: newDevice
  });
});

/**
 * @route GET /api/fog/tasks
 * @desc Get all fog computing tasks
 */
router.get('/tasks', (req: Request, res: Response) => {
  initializeSampleData();
  
  res.json({
    success: true,
    data: fogTasks.map(task => ({
      ...task,
      dataSizeMb: task.dataSize.toFixed(2),
      maxToleranceTimeSec: task.maxToleranceTime.toFixed(2)
    }))
  });
});

/**
 * @route POST /api/fog/tasks
 * @desc Add a new task for fog computing
 */
router.post('/tasks', (req: Request, res: Response) => {
  initializeSampleData();
  
  const { name, dataSize, computationIntensity, maxToleranceTime, terminalDeviceId, priority } = req.body;
  
  const newTask: Task = {
    id: `task-${Date.now()}`,
    name: name || `Task-${fogTasks.length + 1}`,
    dataSize: dataSize || 20 + Math.random() * 30,
    computationIntensity: computationIntensity || 300,
    maxToleranceTime: maxToleranceTime || 30,
    expectedCompletionTime: 5,
    terminalDeviceId: terminalDeviceId || terminalDevices[0]?.id,
    priority: priority || 3
  };
  
  fogTasks.push(newTask);
  
  res.status(201).json({
    success: true,
    data: newTask
  });
});

/**
 * @route POST /api/fog/schedule
 * @desc Run the Hybrid Heuristic scheduling algorithm
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    initializeSampleData();
    
    const { algorithm = 'hh' } = req.body;
    
    if (fogTasks.length === 0 || fogNodes.length === 0 || terminalDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data for scheduling'
      });
    }
    
    let result;
    const startTime = Date.now();
    
    switch (algorithm.toLowerCase()) {
      case 'hh':
      case 'hybrid':
        const scheduler = new HybridHeuristicScheduler(fogTasks, fogNodes, terminalDevices);
        result = scheduler.schedule();
        break;
      case 'ipso':
      case 'pso':
        result = ipsoOnlySchedule(fogTasks, fogNodes, terminalDevices);
        break;
      case 'iaco':
      case 'aco':
        result = iacoOnlySchedule(fogTasks, fogNodes, terminalDevices);
        break;
      case 'fcfs':
      case 'first-come-first-served':
        result = fcfsSchedule(fogTasks, fogNodes, terminalDevices);
        break;
      case 'rr':
      case 'round-robin':
        result = roundRobinSchedule(fogTasks, fogNodes, terminalDevices);
        break;
      case 'min-min':
      case 'minmin':
        result = minMinSchedule(fogTasks, fogNodes, terminalDevices);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown algorithm: ${algorithm}. Use 'hh', 'ipso', 'iaco', 'fcfs', 'rr', or 'min-min'`
        });
    }
    
    const executionTime = Date.now() - startTime;
    
    // Convert allocations Map to object
    const allocations: Record<string, string> = {};
    result.allocations.forEach((fogNodeId, taskId) => {
      allocations[taskId] = fogNodeId;
    });
    
    res.json({
      success: true,
      data: {
        algorithm: algorithm.toUpperCase(),
        executionTimeMs: executionTime,
        metrics: {
          totalDelay: parseFloat(result.totalDelay.toFixed(4)),
          totalEnergy: parseFloat(result.totalEnergy.toFixed(4)),
          fitness: parseFloat(result.fitness.toFixed(6)),
          reliability: parseFloat(result.reliability.toFixed(2))
        },
        allocations,
        summary: {
          tasksScheduled: fogTasks.length,
          fogNodesUsed: new Set(Object.values(allocations)).size,
          avgDelayPerTask: parseFloat((result.totalDelay / fogTasks.length).toFixed(4)),
          avgEnergyPerTask: parseFloat((result.totalEnergy / fogTasks.length).toFixed(4))
        }
      }
    });
  } catch (error) {
    console.error('Scheduling error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute scheduling algorithm'
    });
  }
});

/**
 * @route POST /api/fog/compare
 * @desc Compare all scheduling algorithms
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    initializeSampleData();
    
    const { taskCount = 50 } = req.body;
    
    // Generate fresh test data
    const testDevices = generateSampleDevices(Math.min(taskCount, 20));
    const testTasks = generateSampleTasks(taskCount, testDevices);
    const testFogNodes = generateSampleFogNodes(10);
    
    const startTime = Date.now();
    
    // Run HH
    const hhStart = Date.now();
    const hhScheduler = new HybridHeuristicScheduler(testTasks, testFogNodes, testDevices);
    const hh = hhScheduler.schedule();
    const hhTime = Date.now() - hhStart;
    
    // Run IPSO
    const ipsoStart = Date.now();
    const ipso = ipsoOnlySchedule(testTasks, testFogNodes, testDevices);
    const ipsoTime = Date.now() - ipsoStart;
    
    // Run IACO
    const iacoStart = Date.now();
    const iaco = iacoOnlySchedule(testTasks, testFogNodes, testDevices);
    const iacoTime = Date.now() - iacoStart;
    
    // Run FCFS
    const fcfsStart = Date.now();
    const fcfs = fcfsSchedule(testTasks, testFogNodes, testDevices);
    const fcfsTime = Date.now() - fcfsStart;
    
    // Run RR
    const rrStart = Date.now();
    const rr = roundRobinSchedule(testTasks, testFogNodes, testDevices);
    const rrTime = Date.now() - rrStart;
    
    // Run Min-Min
    const mmStart = Date.now();
    const minMin = minMinSchedule(testTasks, testFogNodes, testDevices);
    const mmTime = Date.now() - mmStart;
    
    const totalTime = Date.now() - startTime;
    
    // Calculate improvements
    const hhVsRrDelay = ((rr.totalDelay - hh.totalDelay) / rr.totalDelay * 100).toFixed(2);
    const hhVsRrEnergy = ((rr.totalEnergy - hh.totalEnergy) / rr.totalEnergy * 100).toFixed(2);
    const hhVsMmDelay = ((minMin.totalDelay - hh.totalDelay) / minMin.totalDelay * 100).toFixed(2);
    const hhVsMmEnergy = ((minMin.totalEnergy - hh.totalEnergy) / minMin.totalEnergy * 100).toFixed(2);
    const hhVsIpsoDelay = ((ipso.totalDelay - hh.totalDelay) / ipso.totalDelay * 100).toFixed(2);
    const hhVsIacoDelay = ((iaco.totalDelay - hh.totalDelay) / iaco.totalDelay * 100).toFixed(2);
    const hhVsFcfsDelay = ((fcfs.totalDelay - hh.totalDelay) / fcfs.totalDelay * 100).toFixed(2);
    const hhVsFcfsEnergy = ((fcfs.totalEnergy - hh.totalEnergy) / fcfs.totalEnergy * 100).toFixed(2);
    
    res.json({
      success: true,
      data: {
        testParameters: {
          taskCount,
          fogNodeCount: testFogNodes.length,
          deviceCount: testDevices.length
        },
        results: {
          hybridHeuristic: {
            totalDelay: parseFloat(hh.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(hh.totalEnergy.toFixed(4)),
            reliability: parseFloat(hh.reliability.toFixed(2)),
            executionTimeMs: hhTime
          },
          ipso: {
            totalDelay: parseFloat(ipso.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(ipso.totalEnergy.toFixed(4)),
            reliability: parseFloat(ipso.reliability.toFixed(2)),
            executionTimeMs: ipsoTime
          },
          iaco: {
            totalDelay: parseFloat(iaco.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(iaco.totalEnergy.toFixed(4)),
            reliability: parseFloat(iaco.reliability.toFixed(2)),
            executionTimeMs: iacoTime
          },
          fcfs: {
            totalDelay: parseFloat(fcfs.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(fcfs.totalEnergy.toFixed(4)),
            reliability: parseFloat(fcfs.reliability.toFixed(2)),
            executionTimeMs: fcfsTime
          },
          roundRobin: {
            totalDelay: parseFloat(rr.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(rr.totalEnergy.toFixed(4)),
            reliability: parseFloat(rr.reliability.toFixed(2)),
            executionTimeMs: rrTime
          },
          minMin: {
            totalDelay: parseFloat(minMin.totalDelay.toFixed(4)),
            totalEnergy: parseFloat(minMin.totalEnergy.toFixed(4)),
            reliability: parseFloat(minMin.reliability.toFixed(2)),
            executionTimeMs: mmTime
          }
        },
        improvements: {
          hhVsRoundRobin: {
            delayReduction: `${hhVsRrDelay}%`,
            energyReduction: `${hhVsRrEnergy}%`,
            reliabilityGain: `${(hh.reliability - rr.reliability).toFixed(2)}%`
          },
          hhVsFCFS: {
            delayReduction: `${hhVsFcfsDelay}%`,
            energyReduction: `${hhVsFcfsEnergy}%`,
            reliabilityGain: `${(hh.reliability - fcfs.reliability).toFixed(2)}%`
          },
          hhVsMinMin: {
            delayReduction: `${hhVsMmDelay}%`,
            energyReduction: `${hhVsMmEnergy}%`,
            reliabilityGain: `${(hh.reliability - minMin.reliability).toFixed(2)}%`
          },
          hhVsIPSO: {
            delayReduction: `${hhVsIpsoDelay}%`,
            reliabilityGain: `${(hh.reliability - ipso.reliability).toFixed(2)}%`
          },
          hhVsIACO: {
            delayReduction: `${hhVsIacoDelay}%`,
            reliabilityGain: `${(hh.reliability - iaco.reliability).toFixed(2)}%`
          }
        },
        totalComparisonTimeMs: totalTime
      }
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run algorithm comparison'
    });
  }
});

/**
 * @route GET /api/fog/metrics
 * @desc Get performance metrics over different task counts
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // As per paper: 50, 100, 150, 200, 250, 300
    const taskCounts = [50, 100, 150, 200, 250, 300];
    const metrics: any[] = [];
    
    for (const count of taskCounts) {
      const testDevices = generateSampleDevices(Math.min(count, 30));
      const testTasks = generateSampleTasks(count, testDevices);
      const testFogNodes = generateSampleFogNodes(10);
      
      // Run all algorithms
      const hhScheduler = new HybridHeuristicScheduler(testTasks, testFogNodes, testDevices);
      const hh = hhScheduler.schedule();
      const ipso = ipsoOnlySchedule(testTasks, testFogNodes, testDevices);
      const iaco = iacoOnlySchedule(testTasks, testFogNodes, testDevices);
      const fcfs = fcfsSchedule(testTasks, testFogNodes, testDevices);
      const rr = roundRobinSchedule(testTasks, testFogNodes, testDevices);
      const minMin = minMinSchedule(testTasks, testFogNodes, testDevices);
      
      metrics.push({
        taskCount: count,
        completionTime: {
          hh: parseFloat(hh.totalDelay.toFixed(2)),
          ipso: parseFloat(ipso.totalDelay.toFixed(2)),
          iaco: parseFloat(iaco.totalDelay.toFixed(2)),
          fcfs: parseFloat(fcfs.totalDelay.toFixed(2)),
          rr: parseFloat(rr.totalDelay.toFixed(2)),
          minMin: parseFloat(minMin.totalDelay.toFixed(2))
        },
        energyConsumption: {
          hh: parseFloat(hh.totalEnergy.toFixed(2)),
          ipso: parseFloat(ipso.totalEnergy.toFixed(2)),
          iaco: parseFloat(iaco.totalEnergy.toFixed(2)),
          fcfs: parseFloat(fcfs.totalEnergy.toFixed(2)),
          rr: parseFloat(rr.totalEnergy.toFixed(2)),
          minMin: parseFloat(minMin.totalEnergy.toFixed(2))
        },
        reliability: {
          hh: parseFloat(hh.reliability.toFixed(2)),
          ipso: parseFloat(ipso.reliability.toFixed(2)),
          iaco: parseFloat(iaco.reliability.toFixed(2)),
          fcfs: parseFloat(fcfs.reliability.toFixed(2)),
          rr: parseFloat(rr.reliability.toFixed(2)),
          minMin: parseFloat(minMin.reliability.toFixed(2))
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        metrics,
        chartData: {
          completionTime: metrics.map(m => ({
            tasks: m.taskCount,
            HH: m.completionTime.hh,
            FCFS: m.completionTime.fcfs,
            RR: m.completionTime.rr,
            MinMin: m.completionTime.minMin
          })),
          energyConsumption: metrics.map(m => ({
            tasks: m.taskCount,
            HH: m.energyConsumption.hh,
            FCFS: m.energyConsumption.fcfs,
            RR: m.energyConsumption.rr,
            MinMin: m.energyConsumption.minMin
          })),
          reliability: metrics.map(m => ({
            tasks: m.taskCount,
            HH: m.reliability.hh,
            FCFS: m.reliability.fcfs,
            RR: m.reliability.rr,
            MinMin: m.reliability.minMin
          }))
        }
      }
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance metrics'
    });
  }
});

/**
 * @route POST /api/fog/reset
 * @desc Reset fog computing simulation data
 */
router.post('/reset', (req: Request, res: Response) => {
  const { nodeCount = 10, deviceCount = 20, taskCount = 50 } = req.body;
  
  fogNodes = generateSampleFogNodes(nodeCount);
  terminalDevices = generateSampleDevices(deviceCount);
  fogTasks = generateSampleTasks(taskCount, terminalDevices);
  
  res.json({
    success: true,
    message: 'Fog computing simulation reset',
    data: {
      fogNodes: fogNodes.length,
      terminalDevices: terminalDevices.length,
      tasks: fogTasks.length
    }
  });
});

/**
 * @route GET /api/fog/export/csv
 * @desc Export benchmark results as CSV
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { type = 'all' } = req.query;
    
    // Generate benchmark data
    const taskCounts = [50, 100, 150, 200, 250, 300];
    const results: any[] = [];
    
    for (const count of taskCounts) {
      const testDevices = generateSampleDevices(Math.min(count, 30));
      const testTasks = generateSampleTasks(count, testDevices);
      const testFogNodes = generateSampleFogNodes(10);
      
      const hhScheduler = new HybridHeuristicScheduler(testTasks, testFogNodes, testDevices);
      const hh = hhScheduler.schedule();
      const ipso = ipsoOnlySchedule(testTasks, testFogNodes, testDevices);
      const iaco = iacoOnlySchedule(testTasks, testFogNodes, testDevices);
      const fcfs = fcfsSchedule(testTasks, testFogNodes, testDevices);
      const rr = roundRobinSchedule(testTasks, testFogNodes, testDevices);
      const minMin = minMinSchedule(testTasks, testFogNodes, testDevices);
      
      results.push({ count, hh, ipso, iaco, fcfs, rr, minMin });
    }
    
    let csv = '';
    
    if (type === 'delay' || type === 'all') {
      csv += 'COMPLETION TIME (seconds)\n';
      csv += 'TaskCount,HH,IPSO,IACO,FCFS,RoundRobin,MinMin\n';
      results.forEach(r => {
        csv += `${r.count},${r.hh.totalDelay.toFixed(2)},${r.ipso.totalDelay.toFixed(2)},${r.iaco.totalDelay.toFixed(2)},${r.fcfs.totalDelay.toFixed(2)},${r.rr.totalDelay.toFixed(2)},${r.minMin.totalDelay.toFixed(2)}\n`;
      });
      csv += '\n';
    }
    
    if (type === 'energy' || type === 'all') {
      csv += 'ENERGY CONSUMPTION (Joules)\n';
      csv += 'TaskCount,HH,IPSO,IACO,FCFS,RoundRobin,MinMin\n';
      results.forEach(r => {
        csv += `${r.count},${r.hh.totalEnergy.toFixed(2)},${r.ipso.totalEnergy.toFixed(2)},${r.iaco.totalEnergy.toFixed(2)},${r.fcfs.totalEnergy.toFixed(2)},${r.rr.totalEnergy.toFixed(2)},${r.minMin.totalEnergy.toFixed(2)}\n`;
      });
      csv += '\n';
    }
    
    if (type === 'reliability' || type === 'all') {
      csv += 'RELIABILITY (%)\n';
      csv += 'TaskCount,HH,IPSO,IACO,FCFS,RoundRobin,MinMin\n';
      results.forEach(r => {
        csv += `${r.count},${r.hh.reliability.toFixed(2)},${r.ipso.reliability.toFixed(2)},${r.iaco.reliability.toFixed(2)},${r.fcfs.reliability.toFixed(2)},${r.rr.reliability.toFixed(2)},${r.minMin.reliability.toFixed(2)}\n`;
      });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=fog_benchmark_${type}_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export CSV' });
  }
});

/**
 * @route GET /api/fog/export/json
 * @desc Export full benchmark results as JSON
 */
router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const taskCounts = [50, 100, 150, 200, 250, 300];
    const toleranceTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    
    // Generate task count benchmark data
    const taskCountResults: any[] = [];
    for (const count of taskCounts) {
      const testDevices = generateSampleDevices(Math.min(count, 30));
      const testTasks = generateSampleTasks(count, testDevices);
      const testFogNodes = generateSampleFogNodes(10);
      
      const hhScheduler = new HybridHeuristicScheduler(testTasks, testFogNodes, testDevices);
      const hh = hhScheduler.schedule();
      const ipso = ipsoOnlySchedule(testTasks, testFogNodes, testDevices);
      const iaco = iacoOnlySchedule(testTasks, testFogNodes, testDevices);
      const rr = roundRobinSchedule(testTasks, testFogNodes, testDevices);
      const minMin = minMinSchedule(testTasks, testFogNodes, testDevices);
      
      taskCountResults.push({
        taskCount: count,
        hh: { delay: hh.totalDelay, energy: hh.totalEnergy, reliability: hh.reliability },
        ipso: { delay: ipso.totalDelay, energy: ipso.totalEnergy, reliability: ipso.reliability },
        iaco: { delay: iaco.totalDelay, energy: iaco.totalEnergy, reliability: iaco.reliability },
        rr: { delay: rr.totalDelay, energy: rr.totalEnergy, reliability: rr.reliability },
        minMin: { delay: minMin.totalDelay, energy: minMin.totalEnergy, reliability: minMin.reliability },
      });
    }
    
    // Generate tolerance time benchmark data
    const toleranceResults: any[] = [];
    const baseDevices = generateSampleDevices(20);
    const baseFogNodes = generateSampleFogNodes(10);
    
    for (const maxTime of toleranceTimes) {
      const testTasks = generateSampleTasks(200, baseDevices).map(task => ({
        ...task,
        maxToleranceTime: maxTime
      }));
      
      const hhScheduler = new HybridHeuristicScheduler(testTasks, baseFogNodes, baseDevices);
      const hh = hhScheduler.schedule();
      const ipso = ipsoOnlySchedule(testTasks, baseFogNodes, baseDevices);
      const iaco = iacoOnlySchedule(testTasks, baseFogNodes, baseDevices);
      const rr = roundRobinSchedule(testTasks, baseFogNodes, baseDevices);
      
      toleranceResults.push({
        maxToleranceTime: maxTime,
        hh: hh.reliability,
        ipso: ipso.reliability,
        iaco: iaco.reliability,
        rr: rr.reliability,
      });
    }
    
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        paperReference: 'Wang & Li (2019) - Task Scheduling Based on Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing',
        algorithms: ['HH (Hybrid Heuristic)', 'IPSO', 'IACO', 'Round-Robin', 'Min-Min'],
      },
      benchmarks: {
        taskCountVariation: {
          description: 'Performance metrics varying task count (Figures 5, 6, 7 from paper)',
          taskCounts,
          results: taskCountResults,
        },
        toleranceTimeVariation: {
          description: 'Reliability vs Maximum Tolerance Time (Figure 8 from paper)',
          toleranceTimes,
          taskCount: 200,
          results: toleranceResults,
        },
      },
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=fog_benchmark_full_${Date.now()}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export JSON' });
  }
});

/**
 * @route GET /api/fog/tolerance-reliability
 * @desc Get reliability vs maximum tolerance time (Figure 8 from paper)
 */
router.get('/tolerance-reliability', async (req: Request, res: Response) => {
  try {
    // As per paper: 10s to 100s in steps of 10
    const toleranceTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const metrics: any[] = [];
    const taskCount = 200; // Fixed at 200 as per paper
    
    for (const maxTime of toleranceTimes) {
      const testDevices = generateSampleDevices(20);
      // Generate tasks with specific max tolerance time
      const testTasks = generateSampleTasks(taskCount, testDevices).map(task => ({
        ...task,
        maxToleranceTime: maxTime
      }));
      const testFogNodes = generateSampleFogNodes(10);
      
      // Run all algorithms
      const hhScheduler = new HybridHeuristicScheduler(testTasks, testFogNodes, testDevices);
      const hh = hhScheduler.schedule();
      const ipso = ipsoOnlySchedule(testTasks, testFogNodes, testDevices);
      const iaco = iacoOnlySchedule(testTasks, testFogNodes, testDevices);
      const rr = roundRobinSchedule(testTasks, testFogNodes, testDevices);
      
      metrics.push({
        maxToleranceTime: maxTime,
        reliability: {
          hh: parseFloat(hh.reliability.toFixed(2)),
          ipso: parseFloat(ipso.reliability.toFixed(2)),
          iaco: parseFloat(iaco.reliability.toFixed(2)),
          rr: parseFloat(rr.reliability.toFixed(2))
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        description: 'Reliability vs Maximum Tolerance Time (Figure 8)',
        taskCount,
        metrics,
        chartData: metrics.map(m => ({
          time: m.maxToleranceTime,
          HH: m.reliability.hh,
          IPSO: m.reliability.ipso,
          IACO: m.reliability.iaco,
          RR: m.reliability.rr
        }))
      }
    });
  } catch (error) {
    console.error('Tolerance-reliability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tolerance-reliability metrics'
    });
  }
});

export default router;
