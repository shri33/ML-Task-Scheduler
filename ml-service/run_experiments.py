"""
Experiment Runner — Reproducible Research Experiments
=====================================================
One-command runner for all scheduling experiments.
Runs multiple algorithms across multiple seeds, collects statistics,
generates plots, and exports paper-ready results.

Usage:
    python run_experiments.py                              # Default: all algos, 5 seeds
    python run_experiments.py --algorithms EDF SJF Oracle   # Specific algorithms
    python run_experiments.py --seeds 10                    # More seeds for significance
    python run_experiments.py --quick                       # Fast run (2 seeds, 10 batches)
    python run_experiments.py --ablation                    # Include ablation study
"""

import os
import sys
import json
import argparse
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any

import numpy as np
from scipy import stats as scipy_stats

sys.path.insert(0, os.path.dirname(__file__))

from datasets.schema import TaskRecord
from simulation.user_simulator import generate_dataset, ARCHETYPES
from evaluation.benchmarks import (
    run_benchmark,
    run_ablation,
    plot_benchmark_results,
    unified_objective_J,
    simulate_episode,
    fifo_order,
    edf_order,
    sjf_order,
    priority_order,
    random_order,
    weighted_score_order,
    oracle_order,
)


RESULTS_DIR = Path("results/experiments")


def parse_args():
    p = argparse.ArgumentParser(description="Run reproducible scheduling experiments")
    p.add_argument("--algorithms", nargs='+', default=None,
                    help="Which algorithms to benchmark (default: all)")
    p.add_argument("--seeds", type=int, default=5,
                    help="Number of random seeds for statistical significance")
    p.add_argument("--n-batches", type=int, default=50,
                    help="Number of user batches per seed")
    p.add_argument("--batch-size", type=int, default=20,
                    help="Average tasks per user batch")
    p.add_argument("--archetypes", nargs='+', default=None,
                    help="Which user archetypes to test (default: all)")
    p.add_argument("--ablation", action="store_true",
                    help="Run ablation study")
    p.add_argument("--quick", action="store_true",
                    help="Quick run (2 seeds, 10 batches)")
    p.add_argument("--output", type=str, default=None,
                    help="Output directory (default: results/experiments/<timestamp>)")
    return p.parse_args()


def aggregate_multi_seed_results(
    all_results: List[Dict[str, Dict[str, Any]]]
) -> Dict[str, Dict[str, Any]]:
    """
    Aggregate benchmark results across multiple seeds.
    Returns mean±std across seeds with confidence intervals and effect sizes.
    """
    # Collect per-algorithm, per-metric values across all seeds
    algorithm_metrics: Dict[str, Dict[str, List[float]]] = {}

    for seed_result in all_results:
        for algo_name, metrics in seed_result.items():
            if algo_name.startswith('__'):
                continue
            if algo_name not in algorithm_metrics:
                algorithm_metrics[algo_name] = {}
            for metric_name, metric_val in metrics.items():
                if isinstance(metric_val, dict) and 'mean' in metric_val:
                    algorithm_metrics[algo_name].setdefault(metric_name, []).append(metric_val['mean'])

    # Compute cross-seed statistics
    aggregated = {}
    for algo_name, metrics in algorithm_metrics.items():
        algo_stats = {}
        for metric_name, values in metrics.items():
            arr = np.array(values)
            n = len(arr)
            mean = float(np.mean(arr))
            std = float(np.std(arr, ddof=1)) if n > 1 else 0.0
            se = std / np.sqrt(n) if n > 1 else 0.0
            ci_half = scipy_stats.t.ppf(0.975, df=max(n - 1, 1)) * se if n > 1 else 0.0

            algo_stats[metric_name] = {
                'mean': round(mean, 4),
                'std_across_seeds': round(std, 4),
                'ci_lower': round(mean - ci_half, 4),
                'ci_upper': round(mean + ci_half, 4),
                'n_seeds': n,
            }
        aggregated[algo_name] = algo_stats

    # Pairwise effect sizes (Cohen's d on unified_J across seeds)
    algo_names = list(algorithm_metrics.keys())
    pairwise = {}
    for i in range(len(algo_names)):
        for j in range(i + 1, len(algo_names)):
            a, b = algo_names[i], algo_names[j]
            vals_a = np.array(algorithm_metrics[a].get('unified_J', []))
            vals_b = np.array(algorithm_metrics[b].get('unified_J', []))
            if len(vals_a) > 1 and len(vals_b) > 1:
                t_stat, p_value = scipy_stats.ttest_rel(vals_a, vals_b)
                diff = vals_a - vals_b
                d = float(np.mean(diff) / (np.std(diff, ddof=1) + 1e-10))
                pairwise[f"{a} vs {b}"] = {
                    't_stat': round(float(t_stat), 4),
                    'p_value': round(float(p_value), 6),
                    'cohens_d': round(d, 4),
                    'significant_005': float(p_value) < 0.05,
                    'significant_001': float(p_value) < 0.01,
                    'effect_magnitude': (
                        'large' if abs(d) >= 0.8 else
                        'medium' if abs(d) >= 0.5 else
                        'small' if abs(d) >= 0.2 else 'negligible'
                    ),
                }
    aggregated['__cross_seed_tests__'] = pairwise

    return aggregated


def print_results_table(aggregated: Dict[str, Dict[str, Any]]):
    """Pretty-print the aggregated results."""
    metrics = ['completion_rate', 'avg_lateness', 'unified_J', 'ndcg', 'context_switches']
    header = f"{'Algorithm':<25}" + "".join(f"{'  ' + m:<22}" for m in metrics)
    print(header)
    print("-" * len(header))

    for algo_name, algo_stats in sorted(aggregated.items(), key=lambda x: x[1].get('unified_J', {}).get('mean', 999)):
        if algo_name.startswith('__'):
            continue
        row = f"{algo_name:<25}"
        for m in metrics:
            s = algo_stats.get(m, {})
            mean = s.get('mean', 0)
            std = s.get('std_across_seeds', 0)
            row += f"  {mean:>7.3f} \u00b1 {std:<7.3f}   "
        print(row)


def print_significance_table(aggregated: Dict[str, Dict[str, Any]]):
    """Print pairwise statistical significance results."""
    tests = aggregated.get('__cross_seed_tests__', {})
    if not tests:
        return

    print(f"\n{'Comparison':<45} {'Cohen d':>8} {'p-value':>10} {'Effect':>12} {'Sig?':>6}")
    print("-" * 85)
    for pair, stats in sorted(tests.items(), key=lambda x: x[1]['p_value']):
        sig = "\u2713" if stats['significant_005'] else ""
        if stats['significant_001']:
            sig = "\u2713\u2713"
        print(f"{pair:<45} {stats['cohens_d']:>8.3f} {stats['p_value']:>10.6f} {stats['effect_magnitude']:>12} {sig:>6}")


def run_per_archetype_experiment(
    n_batches: int,
    batch_size: int,
    seed: int,
    algorithms: list = None,
) -> Dict[str, Dict]:
    """Run benchmarks separately for each user archetype."""
    results_by_archetype = {}

    for archetype in ARCHETYPES:
        # Generate dataset with only this archetype
        ds = generate_dataset(n_users=max(10, n_batches // 5), tasks_per_user=batch_size, seed=seed)
        user_batches: Dict[str, List[TaskRecord]] = {}
        for r in ds.train + ds.val + ds.test:
            if r.user_archetype == archetype:
                user_batches.setdefault(r.user_id, []).append(r)

        if not user_batches:
            continue

        tasks_list = list(user_batches.values())
        if len(tasks_list) < 3:
            continue

        summary = run_benchmark(tasks_list, algorithms, seed)
        results_by_archetype[archetype] = summary

    return results_by_archetype


def main():
    args = parse_args()
    start_time = time.time()

    if args.quick:
        args.seeds = 2
        args.n_batches = 10
        args.batch_size = 10

    # Output directory
    if args.output:
        out = Path(args.output)
    else:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        out = RESULTS_DIR / ts
    out.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*70}")
    print(f"  EXPERIMENT RUNNER — ML Task Scheduling Research")
    print(f"{'='*70}")
    print(f"  Seeds:         {args.seeds}")
    print(f"  Batches/seed:  {args.n_batches}")
    print(f"  Tasks/batch:   {args.batch_size}")
    print(f"  Algorithms:    {args.algorithms or 'ALL'}")
    print(f"  Output:        {out}")
    print(f"{'='*70}\n")

    # -----------------------------------------------------------------------
    # Phase 1: Multi-seed benchmarks
    # -----------------------------------------------------------------------
    print(f"Phase 1: Running benchmarks across {args.seeds} seeds...\n")

    all_seed_results = []
    for seed_idx in range(args.seeds):
        seed = 42 + seed_idx * 17  # deterministic spread of seeds
        print(f"  Seed {seed_idx + 1}/{args.seeds} (seed={seed})...", end=" ", flush=True)

        ds = generate_dataset(n_users=args.n_batches, tasks_per_user=args.batch_size, seed=seed)
        user_batches: Dict[str, List[TaskRecord]] = {}
        for r in ds.train + ds.val + ds.test:
            user_batches.setdefault(r.user_id, []).append(r)
        tasks_list = list(user_batches.values())

        summary = run_benchmark(tasks_list, args.algorithms, seed)
        all_seed_results.append(summary)
        print(f"done ({len(tasks_list)} batches)")

    # Aggregate across seeds
    aggregated = aggregate_multi_seed_results(all_seed_results)

    print(f"\n{'='*70}")
    print(f"  AGGREGATED RESULTS (across {args.seeds} seeds)")
    print(f"{'='*70}\n")
    print_results_table(aggregated)
    print_significance_table(aggregated)

    # Save aggregated results
    with open(out / "aggregated_results.json", 'w') as f:
        json.dump(aggregated, f, indent=2)
    print(f"\n\U0001f4be Aggregated results saved: {out / 'aggregated_results.json'}")

    # Individual seed results
    with open(out / "per_seed_results.json", 'w') as f:
        json.dump(all_seed_results, f, indent=2, default=str)

    # -----------------------------------------------------------------------
    # Phase 2: Per-archetype analysis
    # -----------------------------------------------------------------------
    print(f"\n{'='*70}")
    print(f"  Phase 2: Per-Archetype Analysis")
    print(f"{'='*70}\n")

    archetype_results = run_per_archetype_experiment(
        args.n_batches, args.batch_size, seed=42, algorithms=args.algorithms
    )
    for arch_name, arch_summary in archetype_results.items():
        algo_j_values = {}
        for algo_name, metrics in arch_summary.items():
            if algo_name.startswith('__'):
                continue
            j_val = metrics.get('unified_J', {}).get('mean', None)
            if j_val is not None:
                algo_j_values[algo_name] = j_val
        if algo_j_values:
            best_algo = min(algo_j_values, key=algo_j_values.get)
            print(f"  {arch_name:<20} Best: {best_algo:<25} J={algo_j_values[best_algo]:.3f}")

    with open(out / "archetype_results.json", 'w') as f:
        json.dump(archetype_results, f, indent=2, default=str)

    # -----------------------------------------------------------------------
    # Phase 3: Ablation study (optional)
    # -----------------------------------------------------------------------
    if args.ablation:
        print(f"\n{'='*70}")
        print(f"  Phase 3: Ablation Study")
        print(f"{'='*70}\n")

        ds = generate_dataset(n_users=args.n_batches, tasks_per_user=args.batch_size, seed=42)
        user_batches_abl: Dict[str, List[TaskRecord]] = {}
        for r in ds.train + ds.val + ds.test:
            user_batches_abl.setdefault(r.user_id, []).append(r)
        tasks_list_abl = list(user_batches_abl.values())

        ablation = run_ablation(tasks_list_abl, seed=42)

        print(f"  {'Config':<25} {'Completion Rate':<20} {'Avg Lateness':<20} {'NDCG':<20}")
        print("  " + "-" * 85)
        for config, m in ablation.items():
            cr = f"{m['completion_rate']['mean']:.3f} \u00b1 {m['completion_rate']['std']:.3f}"
            al = f"{m['avg_lateness']['mean']:.3f} \u00b1 {m['avg_lateness']['std']:.3f}"
            nd = f"{m['ndcg']['mean']:.3f} \u00b1 {m['ndcg']['std']:.3f}"
            print(f"  {config:<25} {cr:<20} {al:<20} {nd:<20}")

        with open(out / "ablation_results.json", 'w') as f:
            json.dump(ablation, f, indent=2)

    # -----------------------------------------------------------------------
    # Phase 4: Generate plots
    # -----------------------------------------------------------------------
    print(f"\n{'='*70}")
    print(f"  Phase 4: Generating Plots")
    print(f"{'='*70}\n")

    # Use first seed's results for plotting
    plot_benchmark_results(all_seed_results[0], str(out))

    # -----------------------------------------------------------------------
    # Final summary
    # -----------------------------------------------------------------------
    elapsed = time.time() - start_time

    # Save experiment metadata
    meta = {
        'experiment_type': 'multi_seed_benchmark',
        'seeds': args.seeds,
        'n_batches': args.n_batches,
        'batch_size': args.batch_size,
        'algorithms': args.algorithms or 'all',
        'elapsed_seconds': round(elapsed, 2),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'archetypes_tested': list(archetype_results.keys()),
        'claim': 'Hybrid RL + metaheuristic scheduling improves deadline adherence under stochastic task durations',
    }
    with open(out / "experiment_metadata.json", 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"\n{'='*70}")
    print(f"  EXPERIMENT COMPLETE")
    print(f"{'='*70}")
    print(f"  Duration:    {elapsed:.1f}s")
    print(f"  Seeds:       {args.seeds}")
    print(f"  Results:     {out}")
    print(f"  Files:")
    for f in sorted(out.iterdir()):
        print(f"    \u2022 {f.name}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    main()
