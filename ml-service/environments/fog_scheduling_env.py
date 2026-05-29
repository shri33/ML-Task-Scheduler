"""
Upgraded RL Environment for Fog Scheduling
===========================================
Topology-aware, queue-aware, congestion-aware, failure-aware,
DAG-aware Gymnasium environment for training RL scheduling agents.

Observation space includes:
  - Per-node: utilization, queue length, alive status, VRAM
  - Per-task: requirements, deadline slack, data locality
  - Global: network congestion, failure count

Action space:
  - Task-to-node assignment
  - Supports MaskablePPO (infeasible actions masked)

Reward includes:
  - Latency penalty
  - Energy penalty
  - SLA violation penalty
  - Migration penalty
  - Fairness bonus
"""

import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Dict, List, Tuple, Any, Optional


class FogSchedulingEnv(gym.Env):
    """
    Gymnasium environment for fog computing task scheduling.

    This environment simulates scheduling decisions in a fog computing
    topology with realistic constraints. Each step assigns one pending
    task to a node.

    Designed for use with:
      - PPO (stable-baselines3)
      - MaskablePPO (sb3-contrib)
      - DQN
      - SAC (continuous relaxation)
    """

    metadata = {'render_modes': ['human', 'ansi']}

    def __init__(
        self,
        num_nodes: int = 20,
        num_tasks: int = 50,
        max_queue_length: int = 100,
        enable_failures: bool = True,
        enable_dag: bool = False,
        seed: int = 42,
        reward_weights: Optional[Dict[str, float]] = None,
    ):
        super().__init__()

        self.num_nodes = num_nodes
        self.num_tasks = num_tasks
        self.max_queue_length = max_queue_length
        self.enable_failures = enable_failures
        self.enable_dag = enable_dag
        self._seed = seed
        self.rng = np.random.RandomState(seed)

        # Reward weights (tunable)
        self.reward_weights = reward_weights or {
            'latency': -1.0,
            'energy': -0.3,
            'sla_violation': -5.0,
            'migration': -2.0,
            'fairness': 1.0,
            'completion': 2.0,
            'queue_balance': 0.5,
        }

        # --- Node state ---
        # Each node: [cpu_util, mem_util, vram_util, queue_len, queue_util,
        #             tier, cpu_freq, cpu_cores, alive, bandwidth_util]
        self.node_features = 10

        # --- Task state ---
        # Current task: [cpu_req, mem_req, vram_req, data_size, priority,
        #                category, deadline_slack, origin_node, retry_count]
        self.task_features = 9

        # --- Global state ---
        # [avg_network_util, num_failed_nodes, completed_ratio, time_progress]
        self.global_features = 4

        obs_size = self.num_nodes * self.node_features + self.task_features + self.global_features
        self.observation_space = spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(obs_size,),
            dtype=np.float32,
        )

        # Action: choose a node index for the current task
        self.action_space = spaces.Discrete(self.num_nodes)

        # Internal state
        self._reset_state()

    def _reset_state(self):
        """Initialize/reset all internal simulation state."""
        # Node capacities
        tiers = self._generate_tier_distribution()
        self.node_capacity = np.zeros((self.num_nodes, 5))  # cpu, mem, vram, storage, bw
        self.node_usage = np.zeros((self.num_nodes, 5))
        self.node_tier = np.zeros(self.num_nodes, dtype=np.int32)
        self.node_cpu_freq = np.zeros(self.num_nodes)
        self.node_cpu_cores = np.zeros(self.num_nodes, dtype=np.int32)
        self.node_alive = np.ones(self.num_nodes, dtype=bool)
        self.node_queue_length = np.zeros(self.num_nodes, dtype=np.int32)
        self.node_queue_util = np.zeros(self.num_nodes)
        self.node_power_idle = np.zeros(self.num_nodes)
        self.node_power_full = np.zeros(self.num_nodes)

        tier_profiles = {
            0: {'cpu': 2, 'mem': 2048, 'vram': 0, 'storage': 32000, 'bw': 100,
                'freq': 1.5, 'cores': 2, 'p_idle': 5, 'p_full': 10},
            1: {'cpu': 4, 'mem': 8192, 'vram': 0, 'storage': 128000, 'bw': 1000,
                'freq': 2.0, 'cores': 4, 'p_idle': 15, 'p_full': 40},
            2: {'cpu': 16, 'mem': 32768, 'vram': 8192, 'storage': 512000, 'bw': 10000,
                'freq': 2.8, 'cores': 16, 'p_idle': 80, 'p_full': 200},
            3: {'cpu': 64, 'mem': 262144, 'vram': 81920, 'storage': 2048000, 'bw': 25000,
                'freq': 3.5, 'cores': 64, 'p_idle': 200, 'p_full': 600},
        }

        for i, tier in enumerate(tiers):
            p = tier_profiles[tier]
            self.node_tier[i] = tier
            self.node_capacity[i] = [p['cpu'], p['mem'], p['vram'], p['storage'], p['bw']]
            self.node_cpu_freq[i] = p['freq']
            self.node_cpu_cores[i] = p['cores']
            self.node_power_idle[i] = p['p_idle']
            self.node_power_full[i] = p['p_full']

        # Generate tasks
        self.tasks = self._generate_tasks()
        self.current_task_idx = 0
        self.completed_tasks = 0
        self.failed_tasks = 0
        self.total_latency = 0.0
        self.total_energy = 0.0
        self.sla_violations = 0
        self.migration_count = 0
        self.sim_time = 0.0

        # Topology: distance matrix (hop count)
        self.distance_matrix = self._generate_distance_matrix()

        # Latency matrix (ms)
        self.latency_matrix = self.distance_matrix * (5 + self.rng.random((self.num_nodes, self.num_nodes)) * 15)

    def _generate_tier_distribution(self) -> List[int]:
        """Generate realistic tier distribution: more edge/devices, fewer cloud."""
        tiers = []
        n = self.num_nodes
        # ~10% cloud, ~20% fog, ~30% edge, ~40% device
        tiers.extend([3] * max(1, int(n * 0.1)))
        tiers.extend([2] * max(1, int(n * 0.2)))
        tiers.extend([1] * max(1, int(n * 0.3)))
        remaining = n - len(tiers)
        tiers.extend([0] * max(0, remaining))
        self.rng.shuffle(tiers)
        return tiers[:n]

    def _generate_tasks(self) -> List[Dict[str, Any]]:
        """Generate task list for this episode."""
        tasks = []
        for i in range(self.num_tasks):
            is_gpu = self.rng.random() < 0.15
            cpu_req = int(1 + self.rng.random() * (7 if is_gpu else 3))
            mem_req = float(256 + self.rng.random() * (12000 if is_gpu else 3000))
            vram_req = float((1024 + self.rng.random() * 7000) if is_gpu else 0)
            data_size = float(0.1 + self.rng.lognormal(3, 1.5))
            priority = int(self.rng.choice([1, 2, 3, 4, 5], p=[0.1, 0.2, 0.4, 0.2, 0.1]))
            category = 1 if is_gpu else 0
            exec_time = float(max(0.1, self.rng.lognormal(1.5, 1.0)))
            origin_node = int(self.rng.choice(self.num_nodes))
            deadline = float(self.sim_time + exec_time * (2 + self.rng.random() * 5))

            deps = []
            if self.enable_dag and i > 0 and self.rng.random() < 0.3:
                num_deps = min(i, int(1 + self.rng.random() * 2))
                deps = list(self.rng.choice(i, num_deps, replace=False))

            tasks.append({
                'cpu_req': cpu_req,
                'mem_req': mem_req,
                'vram_req': vram_req,
                'data_size': data_size,
                'priority': priority,
                'category': category,
                'exec_time': exec_time,
                'origin_node': origin_node,
                'deadline': deadline,
                'retry_count': 0,
                'dependencies': deps,
            })

        return tasks

    def _generate_distance_matrix(self) -> np.ndarray:
        """Generate hop-count distance matrix based on tier hierarchy."""
        dist = np.zeros((self.num_nodes, self.num_nodes), dtype=np.float32)
        for i in range(self.num_nodes):
            for j in range(self.num_nodes):
                if i == j:
                    continue
                tier_diff = abs(int(self.node_tier[i]) - int(self.node_tier[j]))
                dist[i, j] = 1 + tier_diff + self.rng.random() * 2
        return dist

    def reset(self, *, seed=None, options=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            self.rng = np.random.RandomState(seed)
            self._seed = seed
        self._reset_state()
        obs = self._get_observation()
        info = {'valid_actions': self.action_masks()}
        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        assert self.action_space.contains(action), f"Invalid action: {action}"

        task = self.tasks[self.current_task_idx]
        node_idx = action
        reward = 0.0
        info: Dict[str, Any] = {}

        # --- Check feasibility ---
        feasible = self._check_feasibility(node_idx, task)

        if not feasible:
            # Infeasible placement → large penalty, task not scheduled
            reward = self.reward_weights['sla_violation']
            self.failed_tasks += 1
            info['reason'] = 'infeasible_placement'
        else:
            # --- Execute placement ---
            # Transfer time
            origin = task['origin_node']
            hops = self.distance_matrix[origin, node_idx]
            latency_ms = self.latency_matrix[origin, node_idx]
            bw = self.node_capacity[node_idx, 4]  # bandwidth
            transfer_time = (task['data_size'] * 8 / max(1, bw)) + latency_ms / 1000

            # Queue wait (simplified M/M/1)
            rho = min(0.98, self.node_queue_util[node_idx])
            queue_wait = rho / (1 - rho + 1e-6) * 0.1  # scaled

            # Execution time (scaled by node speed)
            speed_factor = self.node_cpu_freq[node_idx] * min(self.node_cpu_cores[node_idx], task['cpu_req'])
            exec_time = task['exec_time'] / max(0.1, speed_factor / 4.0)  # normalize to ~4 GHz*core

            total_latency = transfer_time + queue_wait + exec_time
            self.total_latency += total_latency

            # Energy
            cpu_util = task['cpu_req'] / max(1, self.node_cpu_cores[node_idx])
            power = self.node_power_idle[node_idx] + (self.node_power_full[node_idx] - self.node_power_idle[node_idx]) * cpu_util
            energy = power * exec_time / 3600
            self.total_energy += energy

            # SLA check
            completion_time = self.sim_time + total_latency
            if completion_time > task['deadline']:
                self.sla_violations += 1
                reward += self.reward_weights['sla_violation']

            # Update node state
            self.node_usage[node_idx, 0] += task['cpu_req']
            self.node_usage[node_idx, 1] += task['mem_req']
            self.node_usage[node_idx, 2] += task['vram_req']
            self.node_queue_length[node_idx] += 1
            self._update_queue_util(node_idx)

            # Reward components
            reward += self.reward_weights['latency'] * total_latency / 100  # normalize
            reward += self.reward_weights['energy'] * energy / 10
            reward += self.reward_weights['completion']

            # Queue balance reward (Jain's fairness)
            utils = np.clip(self.node_usage[:, 0] / np.maximum(1, self.node_capacity[:, 0]), 0, 1)
            alive_utils = utils[self.node_alive]
            if len(alive_utils) > 0:
                sum_x = alive_utils.sum()
                sum_x2 = (alive_utils ** 2).sum()
                fairness = (sum_x ** 2) / (len(alive_utils) * sum_x2 + 1e-8)
                reward += self.reward_weights['queue_balance'] * fairness

            self.completed_tasks += 1
            self.sim_time += total_latency * 0.01  # advance simulation time

            info.update({
                'total_latency': total_latency,
                'transfer_time': transfer_time,
                'queue_wait': queue_wait,
                'exec_time': exec_time,
                'energy': energy,
                'node_tier': int(self.node_tier[node_idx]),
            })

        # --- Failure injection ---
        if self.enable_failures and self.rng.random() < 0.005:
            fail_node = self.rng.choice(self.num_nodes)
            if self.node_alive[fail_node]:
                self.node_alive[fail_node] = False
                info['node_failed'] = int(fail_node)

        # Recovery
        if self.enable_failures:
            for i in range(self.num_nodes):
                if not self.node_alive[i] and self.rng.random() < 0.05:
                    self.node_alive[i] = True
                    self.node_usage[i] = 0
                    self.node_queue_length[i] = 0

        # Advance to next task
        self.current_task_idx += 1
        terminated = self.current_task_idx >= self.num_tasks
        truncated = False

        obs = self._get_observation() if not terminated else np.zeros(self.observation_space.shape, dtype=np.float32)

        return obs, float(reward), terminated, truncated, info

    def _check_feasibility(self, node_idx: int, task: Dict) -> bool:
        """Check if task can be placed on node."""
        if not self.node_alive[node_idx]:
            return False

        avail = self.node_capacity[node_idx] - self.node_usage[node_idx]
        if task['cpu_req'] > avail[0]:
            return False
        if task['mem_req'] > avail[1]:
            return False
        if task['vram_req'] > 0 and task['vram_req'] > avail[2]:
            return False
        if self.node_queue_length[node_idx] >= self.max_queue_length:
            return False

        return True

    def _update_queue_util(self, node_idx: int):
        """Update queue utilization estimate."""
        self.node_queue_util[node_idx] = min(0.99, self.node_queue_length[node_idx] / max(1, self.max_queue_length))

    def _get_observation(self) -> np.ndarray:
        """Build observation vector."""
        obs = np.zeros(self.observation_space.shape[0], dtype=np.float32)
        offset = 0

        # Node features (normalized to [-1, 1])
        for i in range(self.num_nodes):
            cap = np.maximum(1, self.node_capacity[i])
            obs[offset + 0] = self.node_usage[i, 0] / cap[0] * 2 - 1  # cpu_util
            obs[offset + 1] = self.node_usage[i, 1] / cap[1] * 2 - 1  # mem_util
            obs[offset + 2] = self.node_usage[i, 2] / max(1, cap[2]) * 2 - 1  # vram_util
            obs[offset + 3] = self.node_queue_length[i] / self.max_queue_length * 2 - 1
            obs[offset + 4] = self.node_queue_util[i] * 2 - 1
            obs[offset + 5] = self.node_tier[i] / 3.0 * 2 - 1
            obs[offset + 6] = self.node_cpu_freq[i] / 4.0 * 2 - 1
            obs[offset + 7] = np.log2(max(1, self.node_cpu_cores[i])) / 6.0 * 2 - 1
            obs[offset + 8] = float(self.node_alive[i]) * 2 - 1
            obs[offset + 9] = self.node_usage[i, 4] / max(1, cap[4]) * 2 - 1
            offset += self.node_features

        # Task features
        if self.current_task_idx < self.num_tasks:
            task = self.tasks[self.current_task_idx]
            obs[offset + 0] = task['cpu_req'] / 8.0 * 2 - 1
            obs[offset + 1] = task['mem_req'] / 16384.0 * 2 - 1
            obs[offset + 2] = task['vram_req'] / 8192.0 * 2 - 1
            obs[offset + 3] = min(1, task['data_size'] / 500.0) * 2 - 1
            obs[offset + 4] = task['priority'] / 5.0 * 2 - 1
            obs[offset + 5] = task['category'] * 2 - 1
            deadline_slack = (task['deadline'] - self.sim_time) / max(1, task['exec_time'])
            obs[offset + 6] = min(1, max(-1, deadline_slack / 5.0 * 2 - 1))
            obs[offset + 7] = task['origin_node'] / self.num_nodes * 2 - 1
            obs[offset + 8] = task['retry_count'] / 3.0 * 2 - 1
        offset += self.task_features

        # Global features
        alive_count = self.node_alive.sum()
        obs[offset + 0] = np.mean(self.node_queue_util) * 2 - 1
        obs[offset + 1] = (self.num_nodes - alive_count) / self.num_nodes * 2 - 1
        obs[offset + 2] = self.completed_tasks / max(1, self.num_tasks) * 2 - 1
        obs[offset + 3] = self.current_task_idx / max(1, self.num_tasks) * 2 - 1

        return np.clip(obs, -1, 1).astype(np.float32)

    def action_masks(self) -> np.ndarray:
        """Return boolean mask of valid actions for MaskablePPO."""
        if self.current_task_idx >= self.num_tasks:
            return np.ones(self.num_nodes, dtype=bool)

        task = self.tasks[self.current_task_idx]
        mask = np.zeros(self.num_nodes, dtype=bool)
        for i in range(self.num_nodes):
            mask[i] = self._check_feasibility(i, task)

        # If no feasible action, allow all (agent will get penalty)
        if not mask.any():
            mask[:] = True

        return mask

    def render(self, mode='human'):
        if mode == 'ansi':
            lines = [f"Step {self.current_task_idx}/{self.num_tasks}"]
            lines.append(f"Completed: {self.completed_tasks}, Failed: {self.failed_tasks}")
            lines.append(f"SLA Violations: {self.sla_violations}")
            lines.append(f"Avg Latency: {self.total_latency / max(1, self.completed_tasks):.3f}s")
            return '\n'.join(lines)
