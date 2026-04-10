"""
Evaluation & Benchmarking Framework
=====================================
Compare scheduling algorithms quantitatively with proper metrics, ablation studies,
and visualization. Designed for research paper reproducibility.

Metrics:
    - Total weighted lateness
    - On-time completion rate
    - Normalized Discounted Cumulative Gain (NDCG) for priority ordering
    - Context switch count
    - Makespan (total schedule duration)

Baselines:
    - FIFO (First-In-First-Out)
    - EDF (Earliest Deadline First)
    - SJF (Shortest Job First)
    - Priority (Highest Priority First)
    - Random
    - Weighted Score (current production)

Usage:
    python -m evaluation.benchmarks                   # Run all benchmarks
    python -m evaluation.benchmarks --algorithms rl edf sjf
    python -m evaluation.benchmarks --ablation        # Run ablation study
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable, Optional, Tuple, Any

import numpy as np
from scipy import stats as scipy_stats

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from datasets.schema import TaskRecord, ScheduleEpisode


# ---------------------------------------------------------------------------
# Unified Objective Function J
# ALL algorithms are evaluated against this SAME metric for fair comparison.
# Must match backend: OBJECTIVE_WEIGHTS in scheduler.service.ts
# ---------------------------------------------------------------------------

OBJECTIVE_WEIGHTS = {
    'LATENESS_ALPHA': 1.0,        # quadratic lateness penalty
    'CONTEXT_SWITCH_LAMBDA': 0.3, # penalty per context switch
    'COMPLETION_MU': 2.0,         # bonus per on-time completion
    'STEP_PENALTY': 0.05,         # small per-task overhead
}


def unified_objective_J(episode: ScheduleEpisode) -> float:
    """
    Unified objective function.
    J = Σ_i [α·lateness_i²] + λ·context_switches - μ·on_time_completions + δ·n_tasks
    LOWER is better (minimization).
    """
    w = OBJECTIVE_WEIGHTS
    lateness_cost = sum(w['LATENESS_ALPHA'] * (t.lateness ** 2) for t in episode.tasks)
    switch_cost = w['CONTEXT_SWITCH_LAMBDA'] * episode.total_context_switches
    completion_bonus = w['COMPLETION_MU'] * episode.tasks_on_time
    step_cost = w['STEP_PENALTY'] * episode.n_tasks
    return lateness_cost + switch_cost - completion_bonus + step_cost


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def total_weighted_lateness(episode: ScheduleEpisode) -> float:
    """Sum of (priority × lateness) for all tasks."""
    return sum(t.priority * t.lateness for t in episode.tasks)


def completion_rate(episode: ScheduleEpisode) -> float:
    """Fraction of tasks completed before their deadline."""
    if episode.n_tasks == 0:
        return 0.0
    on_time = sum(1 for t in episode.tasks if t.completed_before_deadline)
    return on_time / episode.n_tasks


def average_lateness(episode: ScheduleEpisode) -> float:
    """Average lateness across all tasks (0 if on time)."""
    if episode.n_tasks == 0:
        return 0.0
    return sum(t.lateness for t in episode.tasks) / episode.n_tasks


def context_switches(episode: ScheduleEpisode) -> int:
    """Number of times consecutive tasks had different types."""
    switches = 0
    for i in range(1, len(episode.tasks)):
        if episode.tasks[i].task_type != episode.tasks[i-1].task_type:
            switches += 1
    return switches


def makespan(episode: ScheduleEpisode) -> float:
    """Total schedule duration."""
    return sum(t.actual_duration for t in episode.tasks)


def ndcg_priority(episode: ScheduleEpisode, k: Optional[int] = None) -> float:
    """
    Normalized Discounted Cumulative Gain for priority ordering.
    Measures how well the schedule orders high-priority tasks first.
    """
    if episode.n_tasks == 0:
        return 0.0

    relevances = [t.priority for t in episode.tasks]  # actual order
    ideal = sorted(relevances, reverse=True)            # ideal order (highest first)

    if k is None:
        k = len(relevances)
    k = min(k, len(relevances))

    def dcg(rels, k):
        return sum(r / np.log2(i + 2) for i, r in enumerate(rels[:k]))

    dcg_actual = dcg(relevances, k)
    dcg_ideal = dcg(ideal, k)

    if dcg_ideal == 0:
        return 1.0
    return dcg_actual / dcg_ideal


# ---------------------------------------------------------------------------
# Scheduling Policies (operate on task lists)
# ---------------------------------------------------------------------------

def fifo_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """Original order (FIFO)."""
    return list(tasks)


def edf_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """Earliest Deadline First."""
    return sorted(tasks, key=lambda t: t.deadline)


def sjf_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """Shortest Job First (by estimated duration)."""
    return sorted(tasks, key=lambda t: t.estimated_duration)


def priority_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """Highest Priority First."""
    return sorted(tasks, key=lambda t: -t.priority)


def random_order(tasks: List[TaskRecord], rng: np.random.RandomState = None) -> List[TaskRecord]:
    """Random shuffle."""
    t = list(tasks)
    (rng or np.random).shuffle(t)
    return t


def weighted_score_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """Current production scoring: 0.4*load + 0.3*time + 0.3*priority."""
    def score(t):
        load_score = (100 - t.resource_load) / 100
        time_score = max(0, 1 - t.estimated_duration / 20)
        pri_bonus = t.priority / 5
        return load_score * 0.4 + time_score * 0.3 + pri_bonus * 0.3
    return sorted(tasks, key=score, reverse=True)


def oracle_order(tasks: List[TaskRecord]) -> List[TaskRecord]:
    """
    Oracle baseline: optimal ordering using TRUE (actual) durations.
    This gives the upper-bound performance — what a perfect predictor could achieve.
    Sorts by (actual_duration / deadline) ascending, i.e. tightest-ratio tasks first.
    """
    return sorted(tasks, key=lambda t: t.actual_duration / max(t.deadline, 0.01))


# ---------------------------------------------------------------------------
# Simulation engine (execute an ordering policy)
# ---------------------------------------------------------------------------

def simulate_episode(
    tasks: List[TaskRecord],
    ordering_fn: Callable[[List[TaskRecord]], List[TaskRecord]],
    episode_id: str = "ep0",
) -> ScheduleEpisode:
    """Simulate executing tasks in the order specified by the policy."""
    ordered = ordering_fn(tasks)

    current_time = 0.0
    executed_tasks = []
    switches = 0
    on_time = 0
    total_late = 0.0

    for i, task in enumerate(ordered):
        # Execute task
        exec_time = task.actual_duration
        completion_time = current_time + exec_time
        deadline_abs = current_time + task.deadline  # relative to current time

        # For simulation: use a fixed absolute deadline
        # (task.deadline is already a duration, so compare exec_time < deadline)
        before_deadline = exec_time <= task.deadline
        lateness = max(0.0, exec_time - task.deadline)

        new_task = TaskRecord(
            user_id=task.user_id,
            task_id=task.task_id,
            episode_id=episode_id,
            task_size=task.task_size,
            task_type=task.task_type,
            priority=task.priority,
            estimated_duration=task.estimated_duration,
            deadline=task.deadline,
            time_of_day_hour=task.time_of_day_hour,
            day_of_week=task.day_of_week,
            current_workload=len(tasks) - i,
            resource_load=task.resource_load,
            user_avg_completion_rate=task.user_avg_completion_rate,
            user_avg_lateness=task.user_avg_lateness,
            user_tasks_completed_today=i,
            user_archetype=task.user_archetype,
            actual_duration=exec_time,
            completed_before_deadline=before_deadline,
            lateness=round(lateness, 3),
            order_executed=i,
        )
        executed_tasks.append(new_task)

        if before_deadline:
            on_time += 1
        total_late += lateness
        if i > 0 and task.task_type != ordered[i-1].task_type:
            switches += 1

        current_time = completion_time

    return ScheduleEpisode(
        episode_id=episode_id,
        user_id=tasks[0].user_id if tasks else "",
        user_archetype=tasks[0].user_archetype if tasks else "",
        tasks=executed_tasks,
        total_lateness=round(total_late, 3),
        tasks_on_time=on_time,
        total_context_switches=switches,
        total_duration=round(current_time, 3),
    )


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

def run_benchmark(
    tasks_list: List[List[TaskRecord]],
    algorithms: Optional[List[str]] = None,
    seed: int = 42,
) -> Dict[str, Dict[str, float]]:
    """
    Run multiple algorithms on multiple task batches, return aggregated metrics.
    """
    rng = np.random.RandomState(seed)

    available_algorithms = {
        'FIFO': fifo_order,
        'EDF': edf_order,
        'SJF': sjf_order,
        'Priority': priority_order,
        'Random': lambda tasks: random_order(tasks, rng),
        'Weighted Score': weighted_score_order,
        'Oracle (↑upper bound)': oracle_order,
    }

    if algorithms:
        available_algorithms = {k: v for k, v in available_algorithms.items() if k in algorithms}

    results: Dict[str, Dict[str, List[float]]] = {
        name: {
            'weighted_lateness': [],
            'completion_rate': [],
            'avg_lateness': [],
            'context_switches': [],
            'makespan': [],
            'ndcg': [],
            'unified_J': [],  # unified objective function
        }
        for name in available_algorithms
    }

    for batch_idx, tasks in enumerate(tasks_list):
        for algo_name, algo_fn in available_algorithms.items():
            episode = simulate_episode(tasks, algo_fn, f"bench_{batch_idx}")
            results[algo_name]['weighted_lateness'].append(total_weighted_lateness(episode))
            results[algo_name]['completion_rate'].append(completion_rate(episode))
            results[algo_name]['avg_lateness'].append(average_lateness(episode))
            results[algo_name]['context_switches'].append(context_switches(episode))
            results[algo_name]['makespan'].append(makespan(episode))
            results[algo_name]['ndcg'].append(ndcg_priority(episode))
            results[algo_name]['unified_J'].append(unified_objective_J(episode))

    # Aggregate with confidence intervals
    summary = {}
    for algo_name, metrics in results.items():
        algo_summary = {}
        for k, v in metrics.items():
            arr = np.array(v)
            n = len(arr)
            mean = float(np.mean(arr))
            std = float(np.std(arr, ddof=1)) if n > 1 else 0.0
            se = std / np.sqrt(n) if n > 0 else 0.0
            # 95% confidence interval
            ci_half = 1.96 * se
            algo_summary[k] = {
                'mean': round(mean, 4),
                'std': round(std, 4),
                'ci_lower': round(mean - ci_half, 4),
                'ci_upper': round(mean + ci_half, 4),
                'min': round(float(np.min(arr)), 4),
                'max': round(float(np.max(arr)), 4),
            }
        summary[algo_name] = algo_summary

    # Statistical significance: pairwise paired t-tests + Cohen's d effect size
    algo_names = list(results.keys())
    pairwise_stats = {}
    for i in range(len(algo_names)):
        for j in range(i + 1, len(algo_names)):
            a, b = algo_names[i], algo_names[j]
            j_a = np.array(results[a]['unified_J'])
            j_b = np.array(results[b]['unified_J'])
            if len(j_a) > 1 and len(j_b) > 1:
                t_stat, p_value = scipy_stats.ttest_rel(j_a, j_b)
                # Cohen's d (paired)
                diff = j_a - j_b
                cohens_d = float(np.mean(diff) / (np.std(diff, ddof=1) + 1e-10))
                pairwise_stats[f"{a} vs {b}"] = {
                    't_stat': round(float(t_stat), 4),
                    'p_value': round(float(p_value), 6),
                    'cohens_d': round(cohens_d, 4),
                    'significant': float(p_value) < 0.05,
                }
    summary['__statistical_tests__'] = pairwise_stats

    return summary


# ---------------------------------------------------------------------------
# Ablation study
# ---------------------------------------------------------------------------

def run_ablation(
    tasks_list: List[List[TaskRecord]],
    seed: int = 42,
) -> Dict[str, Dict[str, Any]]:
    """
    Ablation study: remove one reward/feature component at a time
    and measure impact on scheduling quality.
    """
    ablation_configs = {
        'Full (baseline)': weighted_score_order,
        'No priority': lambda tasks: sorted(tasks, key=lambda t: t.estimated_duration),
        'No duration': lambda tasks: sorted(tasks, key=lambda t: -t.priority),
        'No load balancing': lambda tasks: sorted(tasks, key=lambda t: -(t.priority / 5 + max(0, 1 - t.estimated_duration / 20))),
        'Random (control)': lambda tasks: random_order(tasks, np.random.RandomState(seed)),
    }

    results = {}
    for config_name, order_fn in ablation_configs.items():
        episodes = [simulate_episode(batch, order_fn, f"abl_{i}") for i, batch in enumerate(tasks_list)]
        rates = [completion_rate(ep) for ep in episodes]
        latenesses = [average_lateness(ep) for ep in episodes]
        ndcgs = [ndcg_priority(ep) for ep in episodes]

        results[config_name] = {
            'completion_rate': {'mean': round(float(np.mean(rates)), 4), 'std': round(float(np.std(rates)), 4)},
            'avg_lateness': {'mean': round(float(np.mean(latenesses)), 4), 'std': round(float(np.std(latenesses)), 4)},
            'ndcg': {'mean': round(float(np.mean(ndcgs)), 4), 'std': round(float(np.std(ndcgs)), 4)},
        }

    return results


# ---------------------------------------------------------------------------
# Visualization (saves matplotlib plots)
# ---------------------------------------------------------------------------

def plot_benchmark_results(summary: Dict, output_dir: str = "results"):
    """Generate comparison plots."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print("⚠️  matplotlib not installed, skipping plots")
        return

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    algorithms = list(summary.keys())
    metrics = ['completion_rate', 'avg_lateness', 'ndcg', 'context_switches']
    titles = ['On-Time Completion Rate', 'Average Lateness (s)', 'Priority NDCG', 'Context Switches']

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Scheduling Algorithm Comparison', fontsize=16, fontweight='bold')

    for idx, (metric, title) in enumerate(zip(metrics, titles)):
        ax = axes[idx // 2][idx % 2]
        means = [summary[a][metric]['mean'] for a in algorithms]
        stds = [summary[a][metric]['std'] for a in algorithms]

        bars = ax.bar(range(len(algorithms)), means, yerr=stds, capsize=4,
                      color=plt.cm.Set2(np.linspace(0, 1, len(algorithms))),
                      edgecolor='gray', linewidth=0.5)
        ax.set_xticks(range(len(algorithms)))
        ax.set_xticklabels(algorithms, rotation=30, ha='right', fontsize=9)
        ax.set_title(title, fontsize=12)
        ax.grid(axis='y', alpha=0.3)

    plt.tight_layout()
    plt.savefig(out / 'algorithm_comparison.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"📊 Plot saved: {out / 'algorithm_comparison.png'}")


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Run scheduling benchmarks")
    p.add_argument("--algorithms", nargs='+', default=None, help="Algorithms to benchmark")
    p.add_argument("--n-batches", type=int, default=50, help="Number of task batches")
    p.add_argument("--batch-size", type=int, default=15, help="Tasks per batch")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    p.add_argument("--ablation", action="store_true", help="Run ablation study")
    p.add_argument("--output", type=str, default="results", help="Output directory")
    p.add_argument("--all", action="store_true", help="Run all benchmarks + ablation")
    return p.parse_args()


def main():
    args = parse_args()
    rng = np.random.RandomState(args.seed)

    # Generate task batches from the simulator
    from simulation.user_simulator import generate_dataset
    dataset = generate_dataset(n_users=args.n_batches, tasks_per_user=args.batch_size, seed=args.seed)

    # Group records by user (each user is one batch)
    user_batches: Dict[str, List[TaskRecord]] = {}
    for r in dataset.train + dataset.val + dataset.test:
        user_batches.setdefault(r.user_id, []).append(r)
    tasks_list = list(user_batches.values())

    print(f"\n{'='*60}")
    print(f"Benchmark Configuration")
    print(f"{'='*60}")
    print(f"  Batches: {len(tasks_list)}")
    print(f"  Avg batch size: {np.mean([len(b) for b in tasks_list]):.0f} tasks")
    print(f"  Seed: {args.seed}")

    # Run benchmark
    print(f"\n{'='*60}")
    print(f"Running Algorithm Benchmark")
    print(f"{'='*60}")

    summary = run_benchmark(tasks_list, args.algorithms, args.seed)

    # Print results table
    metrics_to_show = ['completion_rate', 'avg_lateness', 'ndcg', 'context_switches', 'makespan']
    headers = ['Algorithm'] + [m.replace('_', ' ').title() for m in metrics_to_show]
    print(f"\n{'  '.join(h.ljust(18) for h in headers)}")
    print('-' * 18 * len(headers))

    for algo_name, metrics in sorted(summary.items(), key=lambda x: -x[1]['completion_rate']['mean']):
        row = [algo_name]
        for m in metrics_to_show:
            val = metrics[m]
            row.append(f"{val['mean']:.3f} ± {val['std']:.3f}")
        print('  '.join(v.ljust(18) for v in row))

    # Plot
    plot_benchmark_results(summary, args.output)

    # Save JSON results
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    results_file = out / f"benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump({
            'benchmark': summary,
            'config': {
                'n_batches': len(tasks_list),
                'seed': args.seed,
            },
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }, f, indent=2)
    print(f"\n💾 Results saved: {results_file}")

    # Ablation study
    if args.ablation or args.all:
        print(f"\n{'='*60}")
        print(f"Running Ablation Study")
        print(f"{'='*60}")

        ablation = run_ablation(tasks_list, args.seed)

        print(f"\n{'Config'.ljust(25)} {'Completion Rate'.ljust(20)} {'Avg Lateness'.ljust(20)} {'NDCG'.ljust(20)}")
        print('-' * 85)
        for config, m in ablation.items():
            cr = f"{m['completion_rate']['mean']:.3f} ± {m['completion_rate']['std']:.3f}"
            al = f"{m['avg_lateness']['mean']:.3f} ± {m['avg_lateness']['std']:.3f}"
            nd = f"{m['ndcg']['mean']:.3f} ± {m['ndcg']['std']:.3f}"
            print(f"{config.ljust(25)} {cr.ljust(20)} {al.ljust(20)} {nd.ljust(20)}")

        abl_file = out / f"ablation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(abl_file, 'w') as f:
            json.dump(ablation, f, indent=2)
        print(f"\n💾 Ablation results saved: {abl_file}")


if __name__ == '__main__':
    main()
