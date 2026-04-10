"""
User Behavior Simulator
========================
Generates synthetic but realistic training data for ML models by simulating
how different user archetypes interact with a task scheduling system.

Produces datasets in the formal TaskRecord/DatasetSplit schema.

Usage:
    python -m simulation.user_simulator                    # Generate default dataset
    python -m simulation.user_simulator --users 100 --tasks-per-user 30
    python -m simulation.user_simulator --output datasets/v2
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from datasets.schema import TaskRecord, ScheduleEpisode, DatasetSplit


# ---------------------------------------------------------------------------
# User Archetypes
# ---------------------------------------------------------------------------

ARCHETYPES = {
    'consistent': {
        'speed_mult': 1.0, 'variance': 0.1,
        'procrastination': 0.0, 'fatigue_rate': 0.01,
        'deadline_anxiety': 0.1,      # how much approaching deadlines speed them up
        'task_switch_penalty': 0.5,    # seconds lost when switching task types
        'preferred_hours': list(range(9, 18)),  # 9am-5pm
        'weight': 0.30,
    },
    'burst': {
        'speed_mult': 0.7, 'variance': 0.4,
        'procrastination': 0.0, 'fatigue_rate': 0.05,
        'deadline_anxiety': 0.3,
        'task_switch_penalty': 0.2,
        'preferred_hours': list(range(10, 14)) + list(range(20, 24)),
        'weight': 0.20,
    },
    'procrastinator': {
        'speed_mult': 1.2, 'variance': 0.2,
        'procrastination': 3.0, 'fatigue_rate': 0.02,
        'deadline_anxiety': 0.6,     # panics near deadline, speeds up
        'task_switch_penalty': 1.0,
        'preferred_hours': list(range(14, 23)),
        'weight': 0.20,
    },
    'efficient': {
        'speed_mult': 0.8, 'variance': 0.05,
        'procrastination': 0.0, 'fatigue_rate': 0.005,
        'deadline_anxiety': 0.05,
        'task_switch_penalty': 0.1,   # minimal switching cost
        'preferred_hours': list(range(6, 12)),
        'weight': 0.15,
    },
    'overwhelmed': {
        'speed_mult': 1.5, 'variance': 0.5,
        'procrastination': 1.0, 'fatigue_rate': 0.08,
        'deadline_anxiety': 0.8,     # strong panic effect
        'task_switch_penalty': 1.5,  # high context switch cost
        'preferred_hours': list(range(8, 22)),
        'weight': 0.15,
    },
}


def simulate_user(
    user_id: str,
    archetype_name: str,
    n_tasks: int,
    rng: np.random.RandomState,
) -> List[TaskRecord]:
    """Simulate one user completing a batch of tasks."""
    arch = ARCHETYPES[archetype_name]
    records = []

    # Pick a starting hour
    hour = int(rng.choice(arch['preferred_hours']))
    day_of_week = int(rng.randint(0, 7))

    # Track user state
    tasks_completed = 0
    total_lateness = 0.0
    on_time_count = 0
    current_time = 0.0
    last_task_type = 0  # Track for context switch penalty

    for i in range(n_tasks):
        # Generate task
        size = int(rng.choice([1, 2, 3], p=[0.4, 0.35, 0.25]))
        task_type = int(rng.choice([1, 2, 3], p=[0.4, 0.3, 0.3]))
        priority = int(rng.choice([1, 2, 3, 4, 5], p=[0.1, 0.2, 0.3, 0.25, 0.15]))

        # Estimated duration (what the system predicts)
        base_duration = size * 2.0
        type_mod = {1: 1.0, 2: 1.3, 3: 1.15}[task_type]
        estimated_duration = base_duration * type_mod
        estimated_duration = max(0.5, estimated_duration + rng.normal(0, 0.3))

        # ML prediction (estimated + noise — realistically imperfect)
        prediction_noise = rng.normal(0, 0.5 * estimated_duration * 0.15)
        predicted_duration = max(0.3, estimated_duration + prediction_noise)

        # Deadline: higher priority → tighter
        slack = 1.5 + (5 - priority) * 0.5
        deadline = estimated_duration * slack + rng.exponential(5.0)
        deadline = max(estimated_duration + 1.0, deadline)

        # Actual execution with user behavior modeling:
        # 1. Base speed
        fatigue = 1.0 + arch['fatigue_rate'] * tasks_completed
        procrastination = arch['procrastination'] * rng.uniform(0, 1)

        # 2. Task switch penalty (new) — switching task types incurs overhead
        switch_penalty = 0.0
        if last_task_type != 0 and task_type != last_task_type:
            switch_penalty = arch['task_switch_penalty'] * rng.uniform(0.5, 1.5)

        # 3. Deadline anxiety (new) — approaching deadline can speed up or cause errors
        time_until_deadline = deadline  # relative from start of this task
        anxiety_factor = 1.0
        if time_until_deadline < estimated_duration * 2.0:
            # Near deadline: anxiety speeds up but adds variance
            anxiety_factor = max(0.7, 1.0 - arch['deadline_anxiety'])
            # But also adds more noise (errors under pressure)
            procrastination *= 0.3  # less procrastination when panicking

        noise = rng.normal(0, arch['variance'] * estimated_duration)
        actual_duration = (
            estimated_duration * arch['speed_mult'] * fatigue * anxiety_factor
            + procrastination + switch_penalty + noise
        )
        actual_duration = max(0.5, actual_duration)

        # ML completion probability prediction
        predicted_completion_prob = min(0.99, max(0.05,
            0.8 - (predicted_duration / deadline) * 0.3 + rng.normal(0, 0.05)
        ))

        # Did they finish before deadline?
        completion_time = current_time + actual_duration
        completed_before_deadline = completion_time <= (current_time + deadline)
        lateness = max(0.0, completion_time - (current_time + deadline))

        if completed_before_deadline:
            on_time_count += 1
        total_lateness += lateness
        tasks_completed += 1

        record = TaskRecord(
            user_id=user_id,
            task_id=f"{user_id}_t{i}",
            episode_id=f"{user_id}_ep0",
            task_size=size,
            task_type=task_type,
            priority=priority,
            estimated_duration=round(estimated_duration, 3),
            deadline=round(deadline, 3),
            predicted_duration=round(predicted_duration, 3),
            predicted_completion_prob=round(predicted_completion_prob, 3),
            time_of_day_hour=hour,
            day_of_week=day_of_week,
            current_workload=n_tasks - i,
            resource_load=round(rng.uniform(20, 80), 1),
            user_avg_completion_rate=round(on_time_count / tasks_completed, 3),
            user_avg_lateness=round(total_lateness / tasks_completed, 3),
            user_tasks_completed_today=tasks_completed,
            user_archetype=archetype_name,
            actual_duration=round(actual_duration, 3),
            completed_before_deadline=completed_before_deadline,
            lateness=round(lateness, 3),
            order_executed=i,
        )
        records.append(record)

        # Advance state
        current_time += actual_duration
        last_task_type = task_type

        # Occasionally shift hour
        if rng.random() < 0.2:
            hour = (hour + 1) % 24

    return records


def generate_dataset(
    n_users: int = 50,
    tasks_per_user: int = 20,
    seed: int = 42,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
) -> DatasetSplit:
    """Generate a complete dataset with train/val/test splits."""
    rng = np.random.RandomState(seed)

    # Decide archetype distribution
    archetype_names = list(ARCHETYPES.keys())
    archetype_weights = [ARCHETYPES[a]['weight'] for a in archetype_names]

    all_records: List[TaskRecord] = []

    for u in range(n_users):
        archetype = str(rng.choice(archetype_names, p=archetype_weights))
        user_id = f"user_{u:04d}"
        n_tasks = tasks_per_user + int(rng.normal(0, 3))
        n_tasks = max(5, n_tasks)

        records = simulate_user(user_id, archetype, n_tasks, rng)
        all_records.extend(records)

    # Shuffle and split
    rng.shuffle(all_records)
    n_total = len(all_records)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    dataset = DatasetSplit(
        name=f"simulated_v1_{n_users}users_{seed}seed",
        description=f"Synthetic dataset with {n_users} users, {len(archetype_names)} archetypes, "
                    f"{n_total} total records. Generated for ML task scheduling research.",
        train=all_records[:n_train],
        val=all_records[n_train:n_train + n_val],
        test=all_records[n_train + n_val:],
        seed=seed,
    )

    return dataset


def parse_args():
    p = argparse.ArgumentParser(description="Generate synthetic user behavior dataset")
    p.add_argument("--users", type=int, default=50, help="Number of simulated users")
    p.add_argument("--tasks-per-user", type=int, default=20, help="Average tasks per user")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    p.add_argument("--output", type=str, default="datasets/simulated_v1", help="Output directory")
    return p.parse_args()


if __name__ == '__main__':
    args = parse_args()

    print(f"🔬 Generating dataset: {args.users} users × ~{args.tasks_per_user} tasks")
    dataset = generate_dataset(
        n_users=args.users,
        tasks_per_user=args.tasks_per_user,
        seed=args.seed,
    )

    print(f"\n📊 Dataset statistics:")
    print(f"   Total records: {dataset.total_records}")
    print(f"   Train: {len(dataset.train)}")
    print(f"   Val:   {len(dataset.val)}")
    print(f"   Test:  {len(dataset.test)}")

    # Archetype distribution
    from collections import Counter
    archetypes = Counter(r.user_archetype for r in dataset.train + dataset.val + dataset.test)
    print(f"\n   Archetype distribution:")
    for a, c in sorted(archetypes.items(), key=lambda x: -x[1]):
        print(f"     {a}: {c} ({c/dataset.total_records:.1%})")

    # Save
    dataset.save(args.output)
