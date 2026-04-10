"""
Deep RL Environment for Task Scheduling (FAANG POMDP Spec)
==========================================================
Implementation of a Finite-Horizon Episodic MDP for scheduling.
Uses a Dict observation space tailored for MultiInputPolicy architectures
(e.g., Stable Baselines 3 PPO).

Features:
- N-dimensional Task Matrix with 9 specific predictive/temporal features.
- Action masking for discrete task selection.
- Global and User Emdedding context representations.
- Stochastic transition dynamics (LogNormal durations).
- Quadratic lateness and context switch penalty bounds.
"""

import math
import numpy as np
from dataclasses import dataclass
from typing import Tuple, Dict, Any, List

try:
    import gymnasium as gym
    from gymnasium import spaces
    GYM_AVAILABLE = True
except ImportError:
    GYM_AVAILABLE = False
    class _FakeSpaces:
        @staticmethod
        def Box(*a, **k): return None
        @staticmethod
        def Discrete(n): return n
        @staticmethod
        def Dict(d): return d
        @staticmethod
        def MultiBinary(n): return n
    class _FakeGym:
        class Env:
            observation_space = None
            action_space = None
            def reset(self, **kw): pass
            def step(self, a): pass
        spaces = _FakeSpaces()
    gym = _FakeGym()
    spaces = _FakeSpaces()


# ---------------------------------------------------------------------------
# Core Datatypes
# ---------------------------------------------------------------------------

@dataclass
class RLTask:
    """Task definition matching the environment variables."""
    id: int
    task_type: int
    priority: float                 # scaled 0-1
    deadline: float                 # absolute time
    estimated_duration: float
    predicted_duration: float       # ML prediction estimate
    predicted_success_prob: float   # ML prediction P(success)
    created_at: float               # simulation start offset
    
    # State tracking
    is_started: bool = False
    is_completed: bool = False
    actual_duration: float = 0.0
    completion_time: float = 0.0


@dataclass
class RLUserEmbedding:
    avg_completion_rate: float
    avg_lateness: float
    productivity_pattern: float     # 0=consistent, 1=burst, 2=procrastinator
    preferred_work_time: float      # peak hour norm


# ---------------------------------------------------------------------------
# Advanced Gymnasium Environment
# ---------------------------------------------------------------------------

class AdvancedSchedulingEnv(gym.Env if GYM_AVAILABLE else object):
    """
    Finite-Horizon Episodic MDP for behavioral task scheduling.
    """
    metadata = {'render_modes': ['ansi']}

    def __init__(
        self,
        max_tasks: int = 50,
        time_horizon: float = 14400.0, # 4 hours typical batch
        seed: int = 42,
        alpha: float = 2.0,            # Lateness penalty wt
        beta: float = 0.5,             # Context switch wt
        gamma: float = 1.0,            # Completion reward wt
        delta: float = 0.1,            # Idle penalty wt
    ):
        super().__init__()
        
        self.max_tasks = max_tasks
        self.time_horizon = time_horizon
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        
        # Reward Config
        self.alpha = alpha
        self.beta = beta
        self.gamma_wt = gamma
        self.delta = delta

        # Space sizes
        self.n_task_features = 9
        self.n_global_features = 5
        self.n_user_features = 4

        if GYM_AVAILABLE:
            self.action_space = spaces.Discrete(self.max_tasks)
            self.observation_space = spaces.Dict({
                "task_matrix": spaces.Box(
                    low=-10.0, high=10.0, 
                    shape=(self.max_tasks, self.n_task_features), 
                    dtype=np.float32
                ),
                "mask": spaces.MultiBinary(self.max_tasks),
                "global_features": spaces.Box(
                    low=-1.0, high=10.0, 
                    shape=(self.n_global_features,), 
                    dtype=np.float32
                ),
                "user_embedding": spaces.Box(
                    low=0.0, high=1.0, 
                    shape=(self.n_user_features,), 
                    dtype=np.float32
                )
            })

        # Internal State
        self.tasks: List[RLTask] = []
        self.user_data: RLUserEmbedding = None
        self.current_time = 0.0
        self.tasks_completed = 0
        self.context_switches = 0
        self.last_task_type = -1
        self.step_count = 0

    def reset(self, *, seed=None, options=None) -> Tuple[Dict[str, np.ndarray], Dict[str, Any]]:
        if seed is not None:
            self.rng = np.random.RandomState(seed)

        self.current_time = 0.0
        self.tasks_completed = 0
        self.context_switches = 0
        self.last_task_type = -1
        self.step_count = 0
        
        # Determine N tasks for this episode (curriculum/random scale)
        n_tasks = self.rng.randint(min(5, self.max_tasks), self.max_tasks + 1)
        self._generate_scenario(n_tasks)

        return self._get_obs(), self._get_info()

    def _generate_scenario(self, n_tasks: int):
        """Generates the task batch and user profile."""
        # Randomize a user profile
        self.user_data = RLUserEmbedding(
            avg_completion_rate=self.rng.uniform(0.5, 0.99),
            avg_lateness=self.rng.exponential(300), 
            productivity_pattern=self.rng.choice([0.0, 0.5, 1.0]),
            preferred_work_time=self.rng.uniform(0, 1)
        )
        
        self.tasks = []
        for i in range(self.max_tasks):
            if i < n_tasks:
                # Actual task
                est_dur = self.rng.lognormal(mean=np.log(120), sigma=0.5) # 2 mins avg
                slack = self.rng.exponential(scale=1800) # 30 mins avg slack
                priority = self.rng.choice([0.2, 0.4, 0.6, 0.8, 1.0])
                
                # ML logic
                pred_noise = self.rng.normal(0, est_dur * 0.15)
                pred_dur = max(10.0, est_dur + pred_noise)
                
                task = RLTask(
                    id=i,
                    task_type=self.rng.choice([0, 1, 2]),
                    priority=priority,
                    estimated_duration=est_dur,
                    predicted_duration=pred_dur,
                    predicted_success_prob=min(0.99, max(0.1, 0.8 + self.rng.normal(0, 0.1))),
                    deadline=est_dur + slack,
                    created_at=0.0
                )
                self.tasks.append(task)
            else:
                # Padding task (dummy)
                task = RLTask(
                    id=i, task_type=-1, priority=0, estimated_duration=0,
                    predicted_duration=0, predicted_success_prob=0,
                    deadline=0, created_at=0, is_completed=True 
                )
                self.tasks.append(task)

    def step(self, action: int) -> Tuple[Dict[str, np.ndarray], float, bool, bool, Dict[str, Any]]:
        self.step_count += 1
        reward = 0.0

        # Validate mask logic (handles invalid action selection gracefully)
        if action < 0 or action >= self.max_tasks or self.tasks[action].is_completed:
            reward -= self.delta # Idle/Invalid penalty
            # Force step time progression slightly to prevent infinite stalling if model fails
            self.current_time += 10.0 
            terminated = self.current_time >= self.time_horizon
            return self._get_obs(), reward, terminated, False, self._get_info()

        task = self.tasks[action]
        task.is_started = True

        # Transition Dynamics: Simulate duration (LogNormal uncertainty)
        # Using predicted_dur as the base mean to simulate "real execution divergence"
        simulated_mean = np.log(max(1.0, task.predicted_duration))
        # Variance scales with user's specific productivity archetype noise
        variance = 0.2 if self.user_data.productivity_pattern == 0.0 else 0.5
        actual_duration = self.rng.lognormal(mean=simulated_mean, sigma=variance)
        
        task.actual_duration = max(1.0, actual_duration)
        task.completion_time = self.current_time + task.actual_duration
        task.is_completed = True

        # Context Switch Penalty calculation
        if self.last_task_type != -1 and task.task_type != self.last_task_type:
            self.context_switches += 1
            reward -= self.beta

        # Lateness Penalty (Quadratic) -- using seconds/60 as mins for numerical stability
        lateness_mins = max(0.0, (task.completion_time - task.deadline) / 60.0)
        reward -= self.alpha * (lateness_mins ** 2)

        # Completion Reward
        reward += self.gamma_wt
        if task.completion_time <= task.deadline:
             # Huge bonus for hitting deadline scaled by priority
             reward += self.gamma_wt * 5.0 * task.priority

        # Advance Time & State
        self.current_time += task.actual_duration
        self.tasks_completed += 1
        self.last_task_type = task.task_type

        # Termination Conditions
        all_real_tasks = [t for t in self.tasks if t.task_type != -1]
        all_done = (self.tasks_completed >= len(all_real_tasks))
        time_expired = (self.current_time >= self.time_horizon)
        
        terminated = all_done or time_expired

        return self._get_obs(), reward, terminated, False, self._get_info()

    def _get_obs(self) -> Dict[str, np.ndarray]:
        """Construct the Dict space observation."""
        task_matrix = np.zeros((self.max_tasks, self.n_task_features), dtype=np.float32)
        mask = np.zeros(self.max_tasks, dtype=np.int8)

        total_deadline_pressure = 0.0
        active_tasks = 0

        for i, t in enumerate(self.tasks):
            if not t.is_completed and t.task_type != -1:
                mask[i] = 1
                active_tasks += 1
                
                # 1. time_to_deadline (normalized)
                ttd = (t.deadline - self.current_time) / max(1.0, self.time_horizon)
                # 2. estimated_duration (normalized)
                est_d = t.estimated_duration / max(1.0, self.time_horizon)
                # 3. priority
                prio = t.priority
                # 4. slack time (normalized)
                slack = (t.deadline - self.current_time - t.estimated_duration) / 3600.0
                # 5. predicted success prob
                psp = t.predicted_success_prob
                # 6. predicted duration
                pd_norm = t.predicted_duration / max(1.0, self.time_horizon)
                # 7. task age
                age = (self.current_time - t.created_at) / max(1.0, self.time_horizon)
                # 8/9. status
                started = float(t.is_started)
                completed = float(t.is_completed)

                task_matrix[i] = [ttd, est_d, prio, slack, psp, pd_norm, age, started, completed]

                val = 1.0 / (max(0.1, t.deadline - self.current_time))
                total_deadline_pressure += val

        # Global Features
        curr_time_norm = self.current_time / self.time_horizon
        rem_time_norm = max(0.0, self.time_horizon - self.current_time) / self.time_horizon
        num_rem_norm = active_tasks / float(self.max_tasks)
        avg_pressure = (total_deadline_pressure / active_tasks) if active_tasks > 0 else 0.0
        c_switch_norm = self.context_switches / float(self.max_tasks)

        global_features = np.array([
            curr_time_norm, rem_time_norm, num_rem_norm, 
            avg_pressure, c_switch_norm
        ], dtype=np.float32)

        # User Embedding
        u = self.user_data
        user_embedding = np.array([
            u.avg_completion_rate, min(1.0, u.avg_lateness / 3600.0), 
            u.productivity_pattern, u.preferred_work_time
        ], dtype=np.float32)

        return {
            "task_matrix": task_matrix,
            "mask": mask,
            "global_features": global_features,
            "user_embedding": user_embedding
        }

    def _get_info(self) -> Dict[str, Any]:
        """Extra debugging and metric tracking info."""
        all_real = [t for t in self.tasks if t.task_type != -1]
        late = len([t for t in all_real if t.is_completed and t.completion_time > t.deadline])
        
        return {
            "current_time": self.current_time,
            "tasks_completed": self.tasks_completed,
            "context_switches": self.context_switches,
            "late_tasks": late,
            "success_rate": (self.tasks_completed - late) / max(1, len(all_real))
        }

    def action_masks(self) -> np.ndarray:
        """Utility function exactly matching SB3 MaskablePPO spec."""
        obs = self._get_obs()
        return obs["mask"].astype(bool)

if __name__ == "__main__":
    # Standard Gym check
    env = AdvancedSchedulingEnv()
    obs, info = env.reset()
    print("Mask array shape:", obs["mask"].shape)
    print("Task Matrix shape:", obs["task_matrix"].shape)
    print("Active valid actions:", np.sum(obs["mask"]))
