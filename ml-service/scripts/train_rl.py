"""
RL Training Script for Fog Scheduling
======================================
Trains PPO / MaskablePPO / DQN / SAC agents on the FogSchedulingEnv.

Features:
  - Curriculum learning (gradually increase task count)
  - Domain randomization (vary topology, failures)
  - Vectorized environments
  - Checkpointing
  - Evaluation callbacks
  - TensorBoard logging

Usage:
  python train_rl.py --algorithm PPO --timesteps 500000
  python train_rl.py --algorithm MaskablePPO --timesteps 1000000 --curriculum
  python train_rl.py --algorithm DQN --timesteps 200000
"""

import os
import sys
import argparse
import time
import logging
from typing import Optional

import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from environments.fog_scheduling_env import FogSchedulingEnv

logger = logging.getLogger(__name__)


def make_env(num_nodes: int, num_tasks: int, enable_failures: bool, enable_dag: bool, seed: int):
    """Factory for creating env instances."""
    def _init():
        env = FogSchedulingEnv(
            num_nodes=num_nodes,
            num_tasks=num_tasks,
            enable_failures=enable_failures,
            enable_dag=enable_dag,
            seed=seed,
        )
        return env
    return _init


def train_ppo(args):
    """Train with PPO."""
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
        from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
        from stable_baselines3.common.monitor import Monitor
    except ImportError:
        print("ERROR: stable-baselines3 not installed. Run: pip install stable-baselines3")
        return

    # Create vectorized training environments
    num_envs = args.num_envs
    env_fns = [
        make_env(args.num_nodes, args.num_tasks, args.failures, args.dag, args.seed + i)
        for i in range(num_envs)
    ]

    if num_envs > 1:
        train_env = SubprocVecEnv(env_fns)
    else:
        train_env = DummyVecEnv(env_fns)

    # Evaluation environment
    eval_env = DummyVecEnv([make_env(args.num_nodes, args.num_tasks, args.failures, args.dag, args.seed + 999)])

    # Callbacks
    callbacks = []
    callbacks.append(EvalCallback(
        eval_env,
        best_model_save_path=os.path.join(args.output_dir, 'best_model'),
        log_path=os.path.join(args.output_dir, 'eval_logs'),
        eval_freq=max(1000, args.total_timesteps // 50),
        n_eval_episodes=5,
        deterministic=True,
    ))
    callbacks.append(CheckpointCallback(
        save_freq=max(5000, args.total_timesteps // 20),
        save_path=os.path.join(args.output_dir, 'checkpoints'),
        name_prefix='ppo_fog',
    ))

    # Create model
    model = PPO(
        'MlpPolicy',
        train_env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        vf_coef=0.5,
        max_grad_norm=0.5,
        verbose=1,
        tensorboard_log=os.path.join(args.output_dir, 'tb_logs'),
        seed=args.seed,
    )

    print(f"\nTraining PPO for {args.total_timesteps} timesteps...")
    print(f"  Nodes: {args.num_nodes}, Tasks: {args.num_tasks}")
    print(f"  Failures: {args.failures}, DAG: {args.dag}")
    print(f"  Envs: {num_envs}")
    print(f"  Output: {args.output_dir}")
    print()

    start_time = time.time()

    if args.curriculum:
        # Curriculum learning: gradually increase task count
        stages = [
            (args.total_timesteps // 4, args.num_tasks // 4),
            (args.total_timesteps // 4, args.num_tasks // 2),
            (args.total_timesteps // 4, args.num_tasks * 3 // 4),
            (args.total_timesteps // 4, args.num_tasks),
        ]
        for timesteps, task_count in stages:
            print(f"\n--- Curriculum stage: {task_count} tasks ---")
            # Recreate envs with new task count
            new_env_fns = [
                make_env(args.num_nodes, task_count, args.failures, args.dag, args.seed + i)
                for i in range(num_envs)
            ]
            train_env = SubprocVecEnv(new_env_fns) if num_envs > 1 else DummyVecEnv(new_env_fns)
            model.set_env(train_env)
            model.learn(total_timesteps=timesteps, callback=callbacks, reset_num_timesteps=False)
    else:
        model.learn(total_timesteps=args.total_timesteps, callback=callbacks)

    elapsed = time.time() - start_time
    print(f"\nTraining completed in {elapsed:.1f}s")

    # Save final model
    final_path = os.path.join(args.output_dir, 'ppo_fog_final')
    model.save(final_path)
    print(f"Final model saved to: {final_path}")

    train_env.close()
    eval_env.close()


def train_maskable_ppo(args):
    """Train with MaskablePPO (action masking for infeasible placements)."""
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.vec_env import DummyVecEnv
        from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
    except ImportError:
        print("ERROR: sb3-contrib not installed. Run: pip install sb3-contrib")
        return

    def mask_fn(env) -> np.ndarray:
        return env.action_masks()

    # Single env (MaskablePPO doesn't support SubprocVecEnv easily)
    env = FogSchedulingEnv(
        num_nodes=args.num_nodes,
        num_tasks=args.num_tasks,
        enable_failures=args.failures,
        enable_dag=args.dag,
        seed=args.seed,
    )
    env = ActionMasker(env, mask_fn)

    eval_env = FogSchedulingEnv(
        num_nodes=args.num_nodes,
        num_tasks=args.num_tasks,
        enable_failures=args.failures,
        enable_dag=args.dag,
        seed=args.seed + 999,
    )
    eval_env = ActionMasker(eval_env, mask_fn)

    callbacks = [
        EvalCallback(
            eval_env,
            best_model_save_path=os.path.join(args.output_dir, 'best_model'),
            log_path=os.path.join(args.output_dir, 'eval_logs'),
            eval_freq=max(1000, args.total_timesteps // 50),
            n_eval_episodes=5,
        ),
        CheckpointCallback(
            save_freq=max(5000, args.total_timesteps // 20),
            save_path=os.path.join(args.output_dir, 'checkpoints'),
            name_prefix='maskable_ppo_fog',
        ),
    ]

    model = MaskablePPO(
        'MlpPolicy',
        env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        verbose=1,
        tensorboard_log=os.path.join(args.output_dir, 'tb_logs'),
        seed=args.seed,
    )

    print(f"\nTraining MaskablePPO for {args.total_timesteps} timesteps...")
    model.learn(total_timesteps=args.total_timesteps, callback=callbacks)

    final_path = os.path.join(args.output_dir, 'maskable_ppo_fog_final')
    model.save(final_path)
    print(f"Final model saved to: {final_path}")


def train_dqn(args):
    """Train with DQN."""
    try:
        from stable_baselines3 import DQN
        from stable_baselines3.common.vec_env import DummyVecEnv
        from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
    except ImportError:
        print("ERROR: stable-baselines3 not installed.")
        return

    train_env = DummyVecEnv([make_env(args.num_nodes, args.num_tasks, args.failures, args.dag, args.seed)])
    eval_env = DummyVecEnv([make_env(args.num_nodes, args.num_tasks, args.failures, args.dag, args.seed + 999)])

    callbacks = [
        EvalCallback(eval_env, best_model_save_path=os.path.join(args.output_dir, 'best_model'),
                     eval_freq=max(1000, args.total_timesteps // 50), n_eval_episodes=5),
        CheckpointCallback(save_freq=max(5000, args.total_timesteps // 20),
                          save_path=os.path.join(args.output_dir, 'checkpoints'), name_prefix='dqn_fog'),
    ]

    model = DQN(
        'MlpPolicy',
        train_env,
        learning_rate=1e-4,
        buffer_size=100000,
        learning_starts=1000,
        batch_size=64,
        tau=0.005,
        gamma=0.99,
        exploration_fraction=0.2,
        exploration_final_eps=0.05,
        verbose=1,
        tensorboard_log=os.path.join(args.output_dir, 'tb_logs'),
        seed=args.seed,
    )

    print(f"\nTraining DQN for {args.total_timesteps} timesteps...")
    model.learn(total_timesteps=args.total_timesteps, callback=callbacks)

    final_path = os.path.join(args.output_dir, 'dqn_fog_final')
    model.save(final_path)
    print(f"Final model saved to: {final_path}")

    train_env.close()
    eval_env.close()


def evaluate_model(model_path: str, args):
    """Evaluate a trained model."""
    try:
        from stable_baselines3 import PPO
    except ImportError:
        print("ERROR: stable-baselines3 not installed.")
        return

    env = FogSchedulingEnv(
        num_nodes=args.num_nodes,
        num_tasks=args.num_tasks,
        enable_failures=args.failures,
        enable_dag=args.dag,
        seed=args.seed + 12345,
    )

    model = PPO.load(model_path)

    num_episodes = 30
    all_rewards = []
    all_latencies = []
    all_sla = []

    for ep in range(num_episodes):
        obs, info = env.reset(seed=args.seed + ep * 100)
        total_reward = 0
        done = False

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated

        all_rewards.append(total_reward)
        avg_lat = env.total_latency / max(1, env.completed_tasks)
        all_latencies.append(avg_lat)
        all_sla.append(env.sla_violations)

    print(f"\nEvaluation Results ({num_episodes} episodes):")
    print(f"  Avg Reward: {np.mean(all_rewards):.2f} ± {np.std(all_rewards):.2f}")
    print(f"  Avg Latency: {np.mean(all_latencies):.4f} ± {np.std(all_latencies):.4f}")
    print(f"  Avg SLA Violations: {np.mean(all_sla):.1f} ± {np.std(all_sla):.1f}")
    print(f"  Completion Rate: {env.completed_tasks / max(1, env.num_tasks) * 100:.1f}%")


def main():
    parser = argparse.ArgumentParser(description='RL Training for Fog Scheduling')
    parser.add_argument('--algorithm', type=str, default='PPO', choices=['PPO', 'MaskablePPO', 'DQN', 'SAC'])
    parser.add_argument('--total-timesteps', type=int, default=500000)
    parser.add_argument('--num-nodes', type=int, default=20)
    parser.add_argument('--num-tasks', type=int, default=50)
    parser.add_argument('--num-envs', type=int, default=4)
    parser.add_argument('--failures', action='store_true', default=False)
    parser.add_argument('--dag', action='store_true', default=False)
    parser.add_argument('--curriculum', action='store_true', default=False)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output-dir', type=str, default='models/rl_fog')
    parser.add_argument('--evaluate', type=str, default=None, help='Path to model to evaluate')

    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    if args.evaluate:
        evaluate_model(args.evaluate, args)
        return

    trainers = {
        'PPO': train_ppo,
        'MaskablePPO': train_maskable_ppo,
        'DQN': train_dqn,
    }

    trainer = trainers.get(args.algorithm)
    if trainer is None:
        print(f"Algorithm {args.algorithm} not yet implemented")
        return

    trainer(args)


if __name__ == '__main__':
    main()
