/**
 * Utility to run CPU-intensive fog scheduling algorithms off the
 * main event-loop thread using Node.js worker_threads.
 *
 * Usage:
 *   const result = await runInWorker(tasks, fogNodes, devices, algorithm);
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import path from 'path';

export interface FogWorkerPayload {
  tasks: any[];
  fogNodes: any[];
  devices: any[];
  algorithm: string;
}

/**
 * Spawn a worker thread that runs the scheduling algorithm and returns
 * the result as a Promise.  Falls back to inline execution if worker
 * creation fails (e.g. in test environments).
 */
export function runSchedulingInWorker(payload: FogWorkerPayload): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(__filename, { workerData: payload });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    } catch {
      // Fallback: run inline (e.g. when __filename points to .ts in dev)
      executeScheduling(payload).then(resolve).catch(reject);
    }
  });
}

// ---- Worker thread entry point ----
if (!isMainThread && parentPort) {
  const payload = workerData as FogWorkerPayload;
  executeScheduling(payload)
    .then((result) => parentPort!.postMessage(result))
    .catch((err) => { throw err; });
}

async function executeScheduling(payload: FogWorkerPayload) {
  // Dynamic import to avoid circular deps at module level
  const {
    HybridHeuristicScheduler,
    fcfsSchedule,
    roundRobinSchedule,
    minMinSchedule,
    ipsoOnlySchedule,
    iacoOnlySchedule,
  } = await import('../services/fogComputing.service');

  const { tasks, fogNodes, devices, algorithm } = payload;

  switch (algorithm.toLowerCase()) {
    case 'hh':
    case 'hybrid': {
      const scheduler = new HybridHeuristicScheduler(tasks, fogNodes, devices);
      return scheduler.schedule();
    }
    case 'ipso':
    case 'pso':
      return ipsoOnlySchedule(tasks, fogNodes, devices);
    case 'iaco':
    case 'aco':
      return iacoOnlySchedule(tasks, fogNodes, devices);
    case 'fcfs':
    case 'first-come-first-served':
      return fcfsSchedule(tasks, fogNodes, devices);
    case 'rr':
    case 'round-robin':
      return roundRobinSchedule(tasks, fogNodes, devices);
    case 'min-min':
    case 'minmin':
      return minMinSchedule(tasks, fogNodes, devices);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}
