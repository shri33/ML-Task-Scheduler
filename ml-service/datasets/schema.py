"""
Dataset Schema for ML Task Scheduling Research
================================================
Formal dataset definitions for training, evaluation, and paper reproducibility.

Classes:
    TaskRecord — One row of training data (task + outcome)
    ScheduleEpisode — A complete scheduling episode (sequence of tasks)
    DatasetSplit — Train/Val/Test split with metadata
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import IntEnum
import json
import csv
from pathlib import Path

import numpy as np
import pandas as pd


class TaskSize(IntEnum):
    SMALL = 1
    MEDIUM = 2
    LARGE = 3


class TaskType(IntEnum):
    CPU = 1
    IO = 2
    MIXED = 3


@dataclass
class TaskRecord:
    """
    One row of training data: a single task with its execution outcome.
    This is the fundamental unit for supervised ML models.
    """
    # Identity
    user_id: str
    task_id: str
    episode_id: str = ""

    # Task features (input)
    task_size: int = 2           # 1=SMALL, 2=MEDIUM, 3=LARGE
    task_type: int = 1           # 1=CPU, 2=IO, 3=MIXED
    priority: int = 3            # 1-5
    estimated_duration: float = 5.0   # seconds (ML-predicted or user-estimated)
    deadline: float = 30.0            # seconds from task creation

    # ML prediction features (input — what the model predicted BEFORE execution)
    predicted_duration: float = 5.0        # ML model's predicted duration
    predicted_completion_prob: float = 0.8  # ML-predicted P(complete before deadline)

    # Context features (input)
    created_at: str = ""              # ISO timestamp
    time_of_day_hour: int = 12        # 0-23
    day_of_week: int = 0              # 0=Mon, 6=Sun
    current_workload: int = 5         # number of pending tasks
    resource_load: float = 50.0       # resource utilization %

    # User behavior features (input)
    user_avg_completion_rate: float = 0.8
    user_avg_lateness: float = 2.0
    user_tasks_completed_today: int = 0
    user_archetype: str = "consistent"

    # Outcome (labels for training)
    actual_duration: float = 5.0
    completed_before_deadline: bool = True
    lateness: float = 0.0             # max(0, completion_time - deadline)
    order_executed: int = 0           # position in execution sequence

    def to_features(self) -> List[float]:
        """Extract feature vector for ML model input (14-dimensional)."""
        return [
            self.task_size,
            self.task_type,
            self.priority,
            self.estimated_duration,
            self.deadline,
            self.predicted_duration,
            self.predicted_completion_prob,
            self.time_of_day_hour / 24.0,
            self.day_of_week / 7.0,
            self.current_workload / 20.0,
            self.resource_load / 100.0,
            self.user_avg_completion_rate,
            self.user_avg_lateness / 10.0,
            self.user_tasks_completed_today / 20.0,
        ]

    def to_duration_label(self) -> float:
        """Target for duration prediction."""
        return self.actual_duration

    def to_success_label(self) -> int:
        """Target for deadline completion classification."""
        return int(self.completed_before_deadline)

    @staticmethod
    def feature_names() -> List[str]:
        return [
            'task_size', 'task_type', 'priority', 'estimated_duration',
            'deadline', 'predicted_duration', 'predicted_completion_prob',
            'time_of_day', 'day_of_week', 'workload',
            'resource_load', 'user_completion_rate', 'user_avg_lateness',
            'user_tasks_today',
        ]


@dataclass
class ScheduleEpisode:
    """
    A complete scheduling episode: a sequence of tasks executed in order.
    Used for RL training and sequence-level evaluation metrics.
    """
    episode_id: str
    user_id: str
    user_archetype: str
    tasks: List[TaskRecord] = field(default_factory=list)
    total_lateness: float = 0.0
    tasks_on_time: int = 0
    total_context_switches: int = 0
    total_duration: float = 0.0
    reward: float = 0.0

    @property
    def n_tasks(self) -> int:
        return len(self.tasks)

    @property
    def completion_rate(self) -> float:
        return self.tasks_on_time / max(self.n_tasks, 1)

    @property
    def avg_lateness(self) -> float:
        return self.total_lateness / max(self.n_tasks, 1)


@dataclass
class DatasetSplit:
    """Train/Val/Test split with metadata for reproducibility."""
    name: str  # e.g., "v1_consistent_2000"
    description: str = ""
    train: List[TaskRecord] = field(default_factory=list)
    val: List[TaskRecord] = field(default_factory=list)
    test: List[TaskRecord] = field(default_factory=list)
    seed: int = 42
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + 'Z')

    @property
    def total_records(self) -> int:
        return len(self.train) + len(self.val) + len(self.test)

    def to_dataframes(self) -> Dict[str, pd.DataFrame]:
        """Convert to pandas DataFrames."""
        return {
            'train': pd.DataFrame([asdict(r) for r in self.train]),
            'val': pd.DataFrame([asdict(r) for r in self.val]),
            'test': pd.DataFrame([asdict(r) for r in self.test]),
        }

    def to_numpy(self) -> Dict[str, tuple]:
        """Convert to (X, y_duration, y_success) numpy arrays."""
        def _convert(records: List[TaskRecord]):
            if not records:
                return np.empty((0, 14)), np.empty(0), np.empty(0)
            X = np.array([r.to_features() for r in records], dtype=np.float32)
            y_dur = np.array([r.to_duration_label() for r in records], dtype=np.float32)
            y_suc = np.array([r.to_success_label() for r in records], dtype=np.int32)
            return X, y_dur, y_suc

        return {
            'train': _convert(self.train),
            'val': _convert(self.val),
            'test': _convert(self.test),
        }

    def save(self, output_dir: str):
        """Save dataset to CSV files."""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        for split_name, records in [('train', self.train), ('val', self.val), ('test', self.test)]:
            if records:
                df = pd.DataFrame([asdict(r) for r in records])
                df.to_csv(out / f"{split_name}.csv", index=False)

        # Save metadata
        meta = {
            'name': self.name,
            'description': self.description,
            'seed': self.seed,
            'created_at': self.created_at,
            'train_size': len(self.train),
            'val_size': len(self.val),
            'test_size': len(self.test),
            'feature_names': TaskRecord.feature_names(),
        }
        with open(out / 'metadata.json', 'w') as f:
            json.dump(meta, f, indent=2)

        print(f"💾 Dataset saved to {out}: {self.total_records} records "
              f"({len(self.train)}/{len(self.val)}/{len(self.test)})")

    @staticmethod
    def load(input_dir: str) -> 'DatasetSplit':
        """Load dataset from CSV files."""
        inp = Path(input_dir)

        with open(inp / 'metadata.json') as f:
            meta = json.load(f)

        def _load_split(name: str) -> List[TaskRecord]:
            path = inp / f"{name}.csv"
            if not path.exists():
                return []
            df = pd.read_csv(path)
            return [TaskRecord(**row) for _, row in df.iterrows()]

        ds = DatasetSplit(
            name=meta['name'],
            description=meta.get('description', ''),
            seed=meta.get('seed', 42),
            created_at=meta.get('created_at', ''),
        )
        ds.train = _load_split('train')
        ds.val = _load_split('val')
        ds.test = _load_split('test')
        return ds


if __name__ == '__main__':
    # Quick sanity check
    record = TaskRecord(
        user_id="u1", task_id="t1", task_size=2, task_type=1,
        priority=4, estimated_duration=4.5, deadline=20.0,
        actual_duration=5.1, completed_before_deadline=True,
    )
    print(f"Features ({len(record.to_features())}): {record.to_features()}")
    print(f"Feature names: {TaskRecord.feature_names()}")
    print(f"Duration label: {record.to_duration_label()}")
    print(f"Success label: {record.to_success_label()}")
