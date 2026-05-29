/**
 * Evaluation Framework
 * ====================
 * Research-grade evaluation with:
 *   - Comprehensive scheduling metrics (makespan, latency percentiles, energy, etc.)
 *   - Statistical rigor (30-run evaluation, confidence intervals, variance)
 *   - Jain's fairness index
 *   - CSV/JSON export
 *   - Reproducibility via seeded runs
 */

import { SimTask, SimNode, RunMetrics, ExperimentResult, ExperimentConfig, TaskState } from '../types';

// ---------------------------------------------------------------------------
// Metrics Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate all scheduling metrics for a completed simulation run.
 */
export function calculateRunMetrics(
  tasks: SimTask[],
  nodes: Map<string, SimNode>,
  solverTimeMs: number,
  timeHorizon: number,
): RunMetrics {
  const completed = tasks.filter((t) => t.state === TaskState.COMPLETED);
  const failed = tasks.filter((t) => t.state === TaskState.FAILED);

  // Latency = endTime - submitTime for completed tasks
  const latencies = completed.map((t) => t.endTime - t.submitTime).sort((a, b) => a - b);
  const queueWaits = completed.map((t) => t.queueWaitTime);

  const makespan = completed.length > 0
    ? Math.max(...completed.map((t) => t.endTime)) - Math.min(...tasks.map((t) => t.submitTime))
    : 0;

  const avgLatency = mean(latencies);
  const p50Latency = percentile(latencies, 0.5);
  const p95Latency = percentile(latencies, 0.95);
  const p99Latency = percentile(latencies, 0.99);
  const avgQueueWait = mean(queueWaits);

  // Throughput = completed tasks / makespan
  const throughput = makespan > 0 ? completed.length / makespan : 0;

  // SLA violations = tasks that missed their deadline
  const slaViolations = completed.filter((t) => t.endTime > t.deadline).length
    + failed.length; // All failed tasks are SLA violations
  const slaViolationRate = tasks.length > 0 ? slaViolations / tasks.length : 0;

  // Migration count
  const migrationCount = tasks.filter((t) => t.state === TaskState.MIGRATING).length;

  // Retry count
  const retryCount = tasks.reduce((sum, t) => sum + t.retryCount, 0);

  // Energy estimation (simplified model: power proportional to CPU utilization)
  let totalEnergy = 0;
  for (const node of nodes.values()) {
    const cpuUtil = node.usage.cpuCores / Math.max(1, node.capacity.cpuCores);
    const power = node.powerIdle + (node.powerFull - node.powerIdle) * cpuUtil;
    totalEnergy += power * timeHorizon / 3600; // Watt-hours
  }

  // Node utilization
  const nodeUtils: number[] = [];
  for (const node of nodes.values()) {
    const cpuUtil = node.usage.cpuCores / Math.max(1, node.capacity.cpuCores);
    nodeUtils.push(cpuUtil);
  }
  const avgNodeUtilization = mean(nodeUtils);

  // Jain's Fairness Index: (sum(xi))^2 / (n * sum(xi^2))
  const fairnessIndex = jainFairnessIndex(nodeUtils);

  // Network utilization (placeholder — requires network simulator state)
  const networkUtilization = 0;
  const avgBandwidthSaturation = 0;

  return {
    makespan,
    avgLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    avgQueueWait,
    totalEnergy,
    throughput,
    slaViolations,
    slaViolationRate,
    migrationCount,
    retryCount,
    failedTasks: failed.length,
    completedTasks: completed.length,
    networkUtilization,
    avgBandwidthSaturation,
    avgNodeUtilization,
    fairnessIndex,
    solverTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Statistical Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate metrics across multiple runs with confidence intervals.
 * Requires at least 2 runs for variance computation.
 */
export function aggregateResults(
  config: ExperimentConfig,
  algorithm: string,
  runs: RunMetrics[],
): ExperimentResult {
  const keys = Object.keys(runs[0]) as (keyof RunMetrics)[];

  const meanMetrics = {} as RunMetrics;
  const stddevMetrics = {} as RunMetrics;
  const ci95Lower = {} as RunMetrics;
  const ci95Upper = {} as RunMetrics;

  for (const key of keys) {
    const values = runs.map((r) => r[key] as number);
    const m = mean(values);
    const s = stddev(values);
    const n = values.length;

    // 95% CI using t-distribution approximation (z=1.96 for large n)
    const tValue = n >= 30 ? 1.96 : tDistApprox(n - 1);
    const ciHalf = tValue * s / Math.sqrt(n);

    (meanMetrics as any)[key] = m;
    (stddevMetrics as any)[key] = s;
    (ci95Lower as any)[key] = m - ciHalf;
    (ci95Upper as any)[key] = m + ciHalf;
  }

  return {
    config,
    algorithm,
    runs,
    mean: meanMetrics,
    stddev: stddevMetrics,
    ci95Lower,
    ci95Upper,
  };
}

// ---------------------------------------------------------------------------
// Export Formatters
// ---------------------------------------------------------------------------

/**
 * Export results as CSV string.
 * One row per algorithm, columns = metric means ± stddev.
 */
export function exportResultsCSV(results: ExperimentResult[]): string {
  if (results.length === 0) return '';

  const keys = Object.keys(results[0].mean) as (keyof RunMetrics)[];
  const headerCols = ['algorithm', ...keys.flatMap((k) => [`${k}_mean`, `${k}_stddev`, `${k}_ci95_lower`, `${k}_ci95_upper`])];
  const header = headerCols.join(',');

  const rows = results.map((r) => {
    const values = [
      r.algorithm,
      ...keys.flatMap((k) => [
        formatNum(r.mean[k] as number),
        formatNum(r.stddev[k] as number),
        formatNum(r.ci95Lower[k] as number),
        formatNum(r.ci95Upper[k] as number),
      ]),
    ];
    return values.join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export results as JSON.
 */
export function exportResultsJSON(results: ExperimentResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Generate a human-readable experiment summary.
 */
export function generateSummary(results: ExperimentResult[]): string {
  const lines: string[] = [];
  const config = results[0]?.config;

  lines.push('=' .repeat(80));
  lines.push(`EXPERIMENT SUMMARY: ${config?.name || 'Unknown'}`);
  lines.push('=' .repeat(80));
  lines.push(`Description: ${config?.description || ''}`);
  lines.push(`Runs per algorithm: ${config?.numRuns || 0}`);
  lines.push(`Task count: ${config?.taskCount || 0}`);
  lines.push(`Node count: cloud=${config?.nodeCount.cloud || 0}, fog=${config?.nodeCount.fog || 0}, edge=${config?.nodeCount.edge || 0}`);
  lines.push(`Topology: ${config?.topologyType || 'N/A'}`);
  lines.push(`Queue model: ${config?.queueModel || 'N/A'}`);
  lines.push(`Failures: ${config?.failureConfig.enabled ? 'ENABLED' : 'DISABLED'}`);
  lines.push(`Workload: ${config?.workloadSource || 'synthetic'}`);
  lines.push('');

  // Comparison table
  const cols = ['Algorithm', 'Makespan', 'Avg Lat', 'P95 Lat', 'Energy', 'SLA Viol%', 'Fairness', 'Solver(ms)'];
  const colWidths = cols.map((c) => Math.max(c.length, 12));

  lines.push(cols.map((c, i) => c.padEnd(colWidths[i])).join(' | '));
  lines.push(colWidths.map((w) => '-'.repeat(w)).join('-+-'));

  for (const r of results) {
    const row = [
      r.algorithm.padEnd(colWidths[0]),
      `${formatNum(r.mean.makespan)}±${formatNum(r.stddev.makespan)}`.padEnd(colWidths[1]),
      `${formatNum(r.mean.avgLatency)}±${formatNum(r.stddev.avgLatency)}`.padEnd(colWidths[2]),
      `${formatNum(r.mean.p95Latency)}±${formatNum(r.stddev.p95Latency)}`.padEnd(colWidths[3]),
      `${formatNum(r.mean.totalEnergy)}±${formatNum(r.stddev.totalEnergy)}`.padEnd(colWidths[4]),
      `${(r.mean.slaViolationRate * 100).toFixed(1)}%`.padEnd(colWidths[5]),
      formatNum(r.mean.fairnessIndex).padEnd(colWidths[6]),
      formatNum(r.mean.solverTimeMs).padEnd(colWidths[7]),
    ];
    lines.push(row.join(' | '));
  }

  lines.push('');

  // Winner analysis
  const byMakespan = [...results].sort((a, b) => a.mean.makespan - b.mean.makespan);
  const byLatency = [...results].sort((a, b) => a.mean.avgLatency - b.mean.avgLatency);
  const byEnergy = [...results].sort((a, b) => a.mean.totalEnergy - b.mean.totalEnergy);
  const bySLA = [...results].sort((a, b) => a.mean.slaViolationRate - b.mean.slaViolationRate);
  const byFairness = [...results].sort((a, b) => b.mean.fairnessIndex - a.mean.fairnessIndex);

  lines.push('WINNERS:');
  lines.push(`  Best Makespan:  ${byMakespan[0]?.algorithm} (${formatNum(byMakespan[0]?.mean.makespan)}s)`);
  lines.push(`  Best Latency:   ${byLatency[0]?.algorithm} (${formatNum(byLatency[0]?.mean.avgLatency)}s)`);
  lines.push(`  Best Energy:    ${byEnergy[0]?.algorithm} (${formatNum(byEnergy[0]?.mean.totalEnergy)} Wh)`);
  lines.push(`  Best SLA:       ${bySLA[0]?.algorithm} (${(bySLA[0]?.mean.slaViolationRate * 100).toFixed(1)}%)`);
  lines.push(`  Best Fairness:  ${byFairness[0]?.algorithm} (${formatNum(byFairness[0]?.mean.fairnessIndex)})`);

  // Statistical significance (pairwise Mann-Whitney U between best and second-best)
  if (results.length >= 2) {
    lines.push('');
    lines.push('STATISTICAL SIGNIFICANCE (makespan, Mann-Whitney U):');
    const bestAlg = byMakespan[0];
    for (let i = 1; i < byMakespan.length; i++) {
      const other = byMakespan[i];
      const { u, significant } = mannWhitneyU(
        bestAlg.runs.map((r) => r.makespan),
        other.runs.map((r) => r.makespan),
      );
      lines.push(`  ${bestAlg.algorithm} vs ${other.algorithm}: U=${u.toFixed(0)}, ${significant ? 'SIGNIFICANT (p<0.05)' : 'NOT significant'}`);
    }
  }

  lines.push('=' .repeat(80));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Math Utilities
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx];
}

/**
 * Jain's Fairness Index: measures equality of resource allocation.
 * Range [1/n, 1]. Value of 1 = perfectly fair.
 */
function jainFairnessIndex(values: number[]): number {
  if (values.length === 0) return 1;
  const sumX = values.reduce((s, v) => s + v, 0);
  const sumX2 = values.reduce((s, v) => s + v * v, 0);
  if (sumX2 === 0) return 1;
  return (sumX * sumX) / (values.length * sumX2);
}

/**
 * Approximate t-distribution critical value for 95% CI.
 * Uses Abramowitz & Stegun approximation for small df.
 */
function tDistApprox(df: number): number {
  // Common t-values for two-tailed 95% CI
  const table: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 25: 2.060, 29: 2.045,
  };
  if (table[df]) return table[df];
  if (df >= 30) return 1.96;
  // Linear interpolation for unlisted values
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (df > keys[i] && df < keys[i + 1]) {
      const t0 = table[keys[i]];
      const t1 = table[keys[i + 1]];
      const frac = (df - keys[i]) / (keys[i + 1] - keys[i]);
      return t0 + frac * (t1 - t0);
    }
  }
  return 2.0;
}

/**
 * Mann-Whitney U test for statistical significance between two samples.
 * Non-parametric test that doesn't assume normality.
 */
function mannWhitneyU(
  sample1: number[],
  sample2: number[],
): { u: number; significant: boolean } {
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Combine and rank
  const combined = [
    ...sample1.map((v) => ({ value: v, group: 1 })),
    ...sample2.map((v) => ({ value: v, group: 2 })),
  ].sort((a, b) => a.value - b.value);

  // Assign ranks (handle ties by averaging)
  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // Sum ranks for group 1
  let r1 = 0;
  for (let idx = 0; idx < combined.length; idx++) {
    if (combined[idx].group === 1) r1 += ranks[idx];
  }

  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);

  // Normal approximation for significance (valid when n1, n2 >= 8)
  const mu = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = Math.abs((u - mu) / Math.max(0.001, sigmaU));

  // p < 0.05 corresponds to |z| > 1.96
  return { u, significant: z > 1.96 };
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  if (Math.abs(n) < 0.01) return n.toExponential(2);
  return n.toFixed(3);
}
