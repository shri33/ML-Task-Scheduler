import {
  HybridHeuristicScheduler,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  roundRobinSchedule,
  minMinSchedule,
  fcfsSchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  useSeed,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';

function runDeterministicTest() {
  console.log('--- RUNNING DETERMINISTIC TEST BASES ---');
  
  const seed = 42;
  const taskCount = 30;
  const fogNodeCount = 5;

  useSeed(seed);
  const fogNodes = generateSampleFogNodes(fogNodeCount);
  const devices = generateSampleDevices(taskCount);
  const tasks = generateSampleTasks(taskCount, devices);
  useSeed(undefined);

  console.log(`Generated: ${fogNodes.length} nodes, ${devices.length} devices, ${tasks.length} tasks`);

  const algorithms = [
    { name: 'HH', fn: (t: Task[], n: FogNode[], d: TerminalDevice[]) => new HybridHeuristicScheduler(t, n, d).schedule() },
    { name: 'IPSO', fn: ipsoOnlySchedule },
    { name: 'IACO', fn: iacoOnlySchedule },
    { name: 'RR', fn: roundRobinSchedule },
    { name: 'Min-Min', fn: minMinSchedule },
    { name: 'FCFS', fn: fcfsSchedule }
  ];

  const results: any[] = [];

  for (const algo of algorithms) {
    // Set seed before running
    useSeed(seed);
    const result = algo.fn(tasks, fogNodes, devices);
    useSeed(undefined); // reset

    // Sort allocations map by task ID to get a deterministic fingerprint
    const allocationsArray = Array.from(result.allocations.entries()) as [string, string][];
    allocationsArray.sort((a, b) => a[0].localeCompare(b[0]));
    
    const fingerprint = allocationsArray
      .map(([taskId, nodeId]) => `${taskId}->${nodeId}`)
      .join(',');

    console.log(`\nAlgorithm: ${algo.name}`);
    console.log(`  Delay: ${result.totalDelay.toFixed(6)}`);
    console.log(`  Energy: ${result.totalEnergy.toFixed(6)}`);
    console.log(`  Fitness: ${result.fitness.toFixed(10)}`);
    console.log(`  Reliability: ${result.reliability.toFixed(6)}%`);
    console.log(`  Fingerprint MD5-like hash length: ${fingerprint.length}`);
    
    results.push({
      name: algo.name,
      delay: result.totalDelay,
      energy: result.totalEnergy,
      fitness: result.fitness,
      reliability: result.reliability,
      allocations: allocationsArray
    });
  }

  return results;
}

// Execute and print
const res = runDeterministicTest();
console.log('\n--- VERIFICATION COMPLETED ---');
