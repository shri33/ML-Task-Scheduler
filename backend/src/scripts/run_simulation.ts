/**
 * Experiment CLI Runner
 * =====================
 * Standalone script to run scheduling experiments from the command line.
 *
 * Usage:
 *   npx ts-node src/scripts/run_simulation.ts
 *   npx ts-node src/scripts/run_simulation.ts --tasks 200 --runs 30
 *   npx ts-node src/scripts/run_simulation.ts --algorithms IPSO,IACO,HH,EDF,MIN_MIN
 *   npx ts-node src/scripts/run_simulation.ts --topology waxman --failures
 */

import { runExperimentCLI } from '../simulation/runner';
import { ExperimentConfig, QueueModel } from '../simulation/types';

// Parse CLI arguments
function parseArgs(): Partial<ExperimentConfig> {
  const args = process.argv.slice(2);
  const config: Partial<ExperimentConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
        config.name = args[++i];
        break;
      case '--tasks':
        config.taskCount = parseInt(args[++i], 10);
        break;
      case '--runs':
        config.numRuns = parseInt(args[++i], 10);
        break;
      case '--algorithms':
        config.algorithms = args[++i].split(',');
        break;
      case '--topology':
        config.topologyType = args[++i] as ExperimentConfig['topologyType'];
        break;
      case '--cloud':
        config.nodeCount = { ...config.nodeCount!, cloud: parseInt(args[++i], 10) };
        break;
      case '--fog':
        config.nodeCount = { ...config.nodeCount!, fog: parseInt(args[++i], 10) };
        break;
      case '--edge':
        config.nodeCount = { ...config.nodeCount!, edge: parseInt(args[++i], 10) };
        break;
      case '--devices':
        config.nodeCount = { ...config.nodeCount!, device: parseInt(args[++i], 10) };
        break;
      case '--failures':
        config.failureConfig = { ...(config.failureConfig as any || {}), enabled: true };
        break;
      case '--no-failures':
        config.failureConfig = { ...(config.failureConfig as any || {}), enabled: false };
        break;
      case '--dag':
        config.enableDAG = true;
        break;
      case '--queue':
        config.queueModel = args[++i] as QueueModel;
        break;
      case '--workload':
        config.workloadSource = args[++i] as ExperimentConfig['workloadSource'];
        break;
      case '--trace-path':
        config.workloadPath = args[++i];
        break;
      case '--horizon':
        config.timeHorizon = parseInt(args[++i], 10);
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
ML Task Scheduler — Simulation Experiment Runner

Usage:
  npx ts-node src/scripts/run_simulation.ts [OPTIONS]

Options:
  --name <string>          Experiment name
  --tasks <number>         Number of tasks (default: 100)
  --runs <number>          Number of independent runs (default: 30)
  --algorithms <list>      Comma-separated: FCFS,SJF,EDF,MIN_MIN,IPSO,IACO,HH,ROUND_ROBIN
  --topology <type>        hierarchical | waxman | barabasi-albert | custom
  --cloud <number>         Number of cloud nodes (default: 2)
  --fog <number>           Number of fog nodes (default: 6)
  --edge <number>          Number of edge nodes (default: 12)
  --devices <number>       Number of device nodes (default: 24)
  --failures               Enable failure injection
  --no-failures            Disable failure injection
  --dag                    Enable DAG workflows
  --queue <model>          MM1 | MG1 (default: MM1)
  --workload <source>      synthetic | google-trace | alibaba-trace | azure-trace
  --trace-path <path>      Path to trace CSV file
  --horizon <seconds>      Simulation time horizon (default: 3600)
  --help                   Show this help message

Examples:
  # Quick test with 5 runs
  npx ts-node src/scripts/run_simulation.ts --tasks 50 --runs 5

  # Full experiment matching paper setup
  npx ts-node src/scripts/run_simulation.ts --tasks 500 --runs 30 --algorithms IPSO,IACO,HH,EDF,MIN_MIN,FCFS --failures

  # Scalability experiment
  npx ts-node src/scripts/run_simulation.ts --tasks 1000 --runs 10 --fog 20 --edge 40
`);
}

// Main
(async () => {
  try {
    const config = parseArgs();
    await runExperimentCLI(config);
  } catch (error) {
    console.error('Experiment failed:', error);
    process.exit(1);
  }
})();
