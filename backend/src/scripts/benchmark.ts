/**
 * Performance Benchmark Script
 * Generates data matching Figures 5-8 from Wang & Li (2019) paper
 * 
 * Usage: npx ts-node src/scripts/benchmark.ts
 */

import {
  HybridHeuristicScheduler,
  roundRobinSchedule,
  minMinSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  generateSampleDevices,
  generateSampleTasks,
  generateSampleFogNodes,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  taskCount: number;
  hh: { delay: number; energy: number; reliability: number; time: number };
  ipso: { delay: number; energy: number; reliability: number; time: number };
  iaco: { delay: number; energy: number; reliability: number; time: number };
  rr: { delay: number; energy: number; reliability: number; time: number };
  minMin: { delay: number; energy: number; reliability: number; time: number };
}

interface ToleranceResult {
  maxToleranceTime: number;
  hh: number;
  ipso: number;
  iaco: number;
  rr: number;
}

const TASK_COUNTS = [50, 100, 150, 200, 250, 300];
const TOLERANCE_TIMES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const FOG_NODE_COUNT = 10;
const ITERATIONS_PER_TEST = 3; // Average over multiple runs

function runBenchmark(): BenchmarkResult[] {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     FOG COMPUTING BENCHMARK - Wang & Li (2019) Paper         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Generating data for Figures 5, 6, 7 from the research paper ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results: BenchmarkResult[] = [];

  for (const taskCount of TASK_COUNTS) {
    console.log(`\n📊 Testing with ${taskCount} tasks...`);
    
    const aggregated = {
      hh: { delay: 0, energy: 0, reliability: 0, time: 0 },
      ipso: { delay: 0, energy: 0, reliability: 0, time: 0 },
      iaco: { delay: 0, energy: 0, reliability: 0, time: 0 },
      rr: { delay: 0, energy: 0, reliability: 0, time: 0 },
      minMin: { delay: 0, energy: 0, reliability: 0, time: 0 },
    };

    for (let iter = 0; iter < ITERATIONS_PER_TEST; iter++) {
      const fogNodes = generateSampleFogNodes(FOG_NODE_COUNT);
      const devices = generateSampleDevices(taskCount);
      const tasks = generateSampleTasks(taskCount, devices);

      // HH Algorithm
      let start = Date.now();
      const hhScheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
      const hhResult = hhScheduler.schedule();
      aggregated.hh.delay += hhResult.totalDelay;
      aggregated.hh.energy += hhResult.totalEnergy;
      aggregated.hh.reliability += hhResult.reliability;
      aggregated.hh.time += Date.now() - start;

      // IPSO Only
      start = Date.now();
      const ipsoResult = ipsoOnlySchedule(tasks, fogNodes, devices);
      aggregated.ipso.delay += ipsoResult.totalDelay;
      aggregated.ipso.energy += ipsoResult.totalEnergy;
      aggregated.ipso.reliability += ipsoResult.reliability;
      aggregated.ipso.time += Date.now() - start;

      // IACO Only
      start = Date.now();
      const iacoResult = iacoOnlySchedule(tasks, fogNodes, devices);
      aggregated.iaco.delay += iacoResult.totalDelay;
      aggregated.iaco.energy += iacoResult.totalEnergy;
      aggregated.iaco.reliability += iacoResult.reliability;
      aggregated.iaco.time += Date.now() - start;

      // Round-Robin
      start = Date.now();
      const rrResult = roundRobinSchedule(tasks, fogNodes, devices);
      aggregated.rr.delay += rrResult.totalDelay;
      aggregated.rr.energy += rrResult.totalEnergy;
      aggregated.rr.reliability += rrResult.reliability;
      aggregated.rr.time += Date.now() - start;

      // Min-Min
      start = Date.now();
      const mmResult = minMinSchedule(tasks, fogNodes, devices);
      aggregated.minMin.delay += mmResult.totalDelay;
      aggregated.minMin.energy += mmResult.totalEnergy;
      aggregated.minMin.reliability += mmResult.reliability;
      aggregated.minMin.time += Date.now() - start;

      process.stdout.write(`  Iteration ${iter + 1}/${ITERATIONS_PER_TEST}\r`);
    }

    // Average results
    const result: BenchmarkResult = {
      taskCount,
      hh: {
        delay: aggregated.hh.delay / ITERATIONS_PER_TEST,
        energy: aggregated.hh.energy / ITERATIONS_PER_TEST,
        reliability: aggregated.hh.reliability / ITERATIONS_PER_TEST,
        time: aggregated.hh.time / ITERATIONS_PER_TEST,
      },
      ipso: {
        delay: aggregated.ipso.delay / ITERATIONS_PER_TEST,
        energy: aggregated.ipso.energy / ITERATIONS_PER_TEST,
        reliability: aggregated.ipso.reliability / ITERATIONS_PER_TEST,
        time: aggregated.ipso.time / ITERATIONS_PER_TEST,
      },
      iaco: {
        delay: aggregated.iaco.delay / ITERATIONS_PER_TEST,
        energy: aggregated.iaco.energy / ITERATIONS_PER_TEST,
        reliability: aggregated.iaco.reliability / ITERATIONS_PER_TEST,
        time: aggregated.iaco.time / ITERATIONS_PER_TEST,
      },
      rr: {
        delay: aggregated.rr.delay / ITERATIONS_PER_TEST,
        energy: aggregated.rr.energy / ITERATIONS_PER_TEST,
        reliability: aggregated.rr.reliability / ITERATIONS_PER_TEST,
        time: aggregated.rr.time / ITERATIONS_PER_TEST,
      },
      minMin: {
        delay: aggregated.minMin.delay / ITERATIONS_PER_TEST,
        energy: aggregated.minMin.energy / ITERATIONS_PER_TEST,
        reliability: aggregated.minMin.reliability / ITERATIONS_PER_TEST,
        time: aggregated.minMin.time / ITERATIONS_PER_TEST,
      },
    };

    results.push(result);
    
    console.log(`  ✅ ${taskCount} tasks complete`);
    console.log(`     HH:   Delay=${result.hh.delay.toFixed(2)}s, Energy=${result.hh.energy.toFixed(2)}J, Reliability=${result.hh.reliability.toFixed(1)}%`);
    console.log(`     RR:   Delay=${result.rr.delay.toFixed(2)}s, Energy=${result.rr.energy.toFixed(2)}J, Reliability=${result.rr.reliability.toFixed(1)}%`);
  }

  return results;
}

function runToleranceBenchmark(): ToleranceResult[] {
  console.log('\n\n📈 Running Maximum Tolerance Time Analysis (Figure 8)...');
  
  const results: ToleranceResult[] = [];
  const taskCount = 200;
  const fogNodes = generateSampleFogNodes(FOG_NODE_COUNT);
  const devices = generateSampleDevices(taskCount);

  for (const maxTime of TOLERANCE_TIMES) {
    // Generate tasks with specific max tolerance time
    const tasks: Task[] = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push({
        id: `task-${i}`,
        name: `Task-${i}`,
        dataSize: 10 + Math.random() * 40,
        computationIntensity: 200 + Math.random() * 200,
        maxToleranceTime: maxTime,
        expectedCompletionTime: maxTime * 0.5,
        terminalDeviceId: devices[i % devices.length].id,
        priority: Math.floor(Math.random() * 5) + 1,
      });
    }

    const hhScheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
    const hhResult = hhScheduler.schedule();
    const ipsoResult = ipsoOnlySchedule(tasks, fogNodes, devices);
    const iacoResult = iacoOnlySchedule(tasks, fogNodes, devices);
    const rrResult = roundRobinSchedule(tasks, fogNodes, devices);

    results.push({
      maxToleranceTime: maxTime,
      hh: hhResult.reliability,
      ipso: ipsoResult.reliability,
      iaco: iacoResult.reliability,
      rr: rrResult.reliability,
    });

    console.log(`  MaxTime=${maxTime}s: HH=${hhResult.reliability.toFixed(1)}%, IPSO=${ipsoResult.reliability.toFixed(1)}%, IACO=${iacoResult.reliability.toFixed(1)}%, RR=${rrResult.reliability.toFixed(1)}%`);
  }

  return results;
}

function exportToCSV(benchmarks: BenchmarkResult[], toleranceResults: ToleranceResult[]) {
  const outputDir = path.join(__dirname, '../../benchmark-results');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Figure 5: Completion Time
  let csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  benchmarks.forEach(b => {
    csv += `${b.taskCount},${b.hh.delay.toFixed(2)},${b.ipso.delay.toFixed(2)},${b.iaco.delay.toFixed(2)},${b.rr.delay.toFixed(2)},${b.minMin.delay.toFixed(2)}\n`;
  });
  fs.writeFileSync(path.join(outputDir, 'figure5_completion_time.csv'), csv);
  console.log('\n📁 Saved: figure5_completion_time.csv');

  // Figure 6: Energy Consumption
  csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  benchmarks.forEach(b => {
    csv += `${b.taskCount},${b.hh.energy.toFixed(2)},${b.ipso.energy.toFixed(2)},${b.iaco.energy.toFixed(2)},${b.rr.energy.toFixed(2)},${b.minMin.energy.toFixed(2)}\n`;
  });
  fs.writeFileSync(path.join(outputDir, 'figure6_energy_consumption.csv'), csv);
  console.log('📁 Saved: figure6_energy_consumption.csv');

  // Figure 7: Reliability vs Task Count
  csv = 'TaskCount,HH,IPSO,IACO,RR,MinMin\n';
  benchmarks.forEach(b => {
    csv += `${b.taskCount},${b.hh.reliability.toFixed(2)},${b.ipso.reliability.toFixed(2)},${b.iaco.reliability.toFixed(2)},${b.rr.reliability.toFixed(2)},${b.minMin.reliability.toFixed(2)}\n`;
  });
  fs.writeFileSync(path.join(outputDir, 'figure7_reliability_tasks.csv'), csv);
  console.log('📁 Saved: figure7_reliability_tasks.csv');

  // Figure 8: Reliability vs Max Tolerance Time
  csv = 'MaxToleranceTime,HH,IPSO,IACO,RR\n';
  toleranceResults.forEach(t => {
    csv += `${t.maxToleranceTime},${t.hh.toFixed(2)},${t.ipso.toFixed(2)},${t.iaco.toFixed(2)},${t.rr.toFixed(2)}\n`;
  });
  fs.writeFileSync(path.join(outputDir, 'figure8_reliability_tolerance.csv'), csv);
  console.log('📁 Saved: figure8_reliability_tolerance.csv');

  // Full benchmark data
  const fullData = {
    generatedAt: new Date().toISOString(),
    paperReference: 'Wang & Li (2019) - Task Scheduling Based on Hybrid Heuristic Algorithm',
    parameters: {
      fogNodes: FOG_NODE_COUNT,
      taskCounts: TASK_COUNTS,
      toleranceTimes: TOLERANCE_TIMES,
      iterationsPerTest: ITERATIONS_PER_TEST,
    },
    completionTime: benchmarks,
    toleranceReliability: toleranceResults,
  };
  fs.writeFileSync(path.join(outputDir, 'full_benchmark_data.json'), JSON.stringify(fullData, null, 2));
  console.log('📁 Saved: full_benchmark_data.json');

  return outputDir;
}

function printSummary(benchmarks: BenchmarkResult[]) {
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    BENCHMARK SUMMARY                          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  // Calculate average improvements
  let totalDelayImprovement = 0;
  let totalEnergyImprovement = 0;
  
  benchmarks.forEach(b => {
    const delayImprov = ((b.rr.delay - b.hh.delay) / b.rr.delay) * 100;
    const energyImprov = ((b.rr.energy - b.hh.energy) / b.rr.energy) * 100;
    totalDelayImprovement += delayImprov;
    totalEnergyImprovement += energyImprov;
  });

  const avgDelayImprovement = totalDelayImprovement / benchmarks.length;
  const avgEnergyImprovement = totalEnergyImprovement / benchmarks.length;

  console.log(`║  HH vs Round-Robin Average Improvement:                       ║`);
  console.log(`║    • Delay Reduction:    ${avgDelayImprovement >= 0 ? '+' : ''}${avgDelayImprovement.toFixed(2)}%                             ║`);
  console.log(`║    • Energy Reduction:   ${avgEnergyImprovement >= 0 ? '+' : ''}${avgEnergyImprovement.toFixed(2)}%                             ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  // Table header
  console.log('║  Tasks │    HH    │   IPSO   │   IACO   │    RR    │  MinMin  ║');
  console.log('╠════════╪══════════╪══════════╪══════════╪══════════╪══════════╣');
  
  benchmarks.forEach(b => {
    console.log(`║  ${b.taskCount.toString().padStart(4)}  │ ${b.hh.delay.toFixed(0).padStart(7)}s │ ${b.ipso.delay.toFixed(0).padStart(7)}s │ ${b.iaco.delay.toFixed(0).padStart(7)}s │ ${b.rr.delay.toFixed(0).padStart(7)}s │ ${b.minMin.delay.toFixed(0).padStart(7)}s ║`);
  });
  
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

// Main execution
async function main() {
  console.log('🚀 Starting Fog Computing Performance Benchmark...');
  console.log(`   Test configuration: ${FOG_NODE_COUNT} fog nodes, ${ITERATIONS_PER_TEST} iterations per test`);
  console.log(`   Task counts: ${TASK_COUNTS.join(', ')}`);
  
  const startTime = Date.now();
  
  const benchmarks = runBenchmark();
  const toleranceResults = runToleranceBenchmark();
  
  printSummary(benchmarks);
  
  const outputDir = exportToCSV(benchmarks, toleranceResults);
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Benchmark complete in ${totalTime}s`);
  console.log(`📂 Results saved to: ${outputDir}`);
}

main().catch(console.error);
