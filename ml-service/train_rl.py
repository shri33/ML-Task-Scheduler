"""
Reinforcement Learning PPO Training Pipeline (SB3)
==================================================
Trains the scheduling agent using Stable Baselines 3 MaskablePPO.
Implements the MultiInputPolicy with a Custom Feature Extractor
to process the Task Matrix, Global Features, and User Embedding.

Usage:
    python train_rl.py --steps 100000 --batch-size 64
"""

import os
import sys
import argparse
from pathlib import Path

import torch
import torch.nn as nn
import numpy as np

# Use sb3-contrib for Action Masking support
from sb3_contrib import MaskablePPO
from sb3_contrib.common.maskable.policies import MaskableMultiInputActorCriticPolicy
from stable_baselines3.common.callbacks import EvalCallback
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from environments.scheduling_env import AdvancedSchedulingEnv


# ---------------------------------------------------------------------------
# Custom PyTorch Feature Extractor for the RL Agent
# ---------------------------------------------------------------------------

class SchedulingFeatureExtractor(BaseFeaturesExtractor):
    """
    Custom Feature Extractor for the Dict observation space.
    Architecture:
    1. Task Matrix -> MLP embedding per task -> Attention Pooling
    2. Global Features -> MLP
    3. User Embedding -> MLP
    4. Concat -> Final context vector
    """
    def __init__(self, observation_space, features_dim: int = 256):
        super().__init__(observation_space, features_dim)
        
        # 1. Task Matrix processing [batch_size, max_tasks, n_features]
        task_shape = observation_space.spaces['task_matrix'].shape
        self.max_tasks = task_shape[0]
        self.task_feat_dim = task_shape[1]
        
        self.task_mlp = nn.Sequential(
            nn.Linear(self.task_feat_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU()
        )
        # Simple attention pool: learn a query vector to weight the tasks
        self.attention_query = nn.Parameter(torch.randn(64))
        
        # 2. Global features processing
        global_dim = observation_space.spaces['global_features'].shape[0]
        self.global_mlp = nn.Sequential(
            nn.Linear(global_dim, 32),
            nn.ReLU()
        )
        
        # 3. User embedding processing
        user_dim = observation_space.spaces['user_embedding'].shape[0]
        self.user_mlp = nn.Sequential(
            nn.Linear(user_dim, 32),
            nn.ReLU()
        )
        
        # Final projection
        # 64 (task attention) + 32 (global) + 32 (user) = 128
        self.final_proj = nn.Sequential(
            nn.Linear(128, features_dim),
            nn.ReLU()
        )

    def forward(self, observations: dict) -> torch.Tensor:
        task_matrix = observations['task_matrix']     # [B, N, F]
        global_feats = observations['global_features'] # [B, G]
        user_feats = observations['user_embedding']    # [B, U]
        
        # 1. Process Task Matrix
        # Flatten batch and N for MLP: [B*N, F] -> [B*N, 64] -> [B, N, 64]
        B = task_matrix.shape[0]
        flat_tasks = task_matrix.view(-1, self.task_feat_dim)
        task_embs = self.task_mlp(flat_tasks).view(B, self.max_tasks, 64)
        
        # Attention Pooling over tasks
        # score = task_embs * query -> [B, N]
        scores = (task_embs * self.attention_query).sum(dim=-1)
        # Mask out invalid tasks (those padded with 0 feature norms basically, or use explicit mask if passed)
        # For simplicity, softmax directly (SB3 handles exact action masking at the policy head)
        attn_weights = torch.softmax(scores, dim=-1).unsqueeze(-1) # [B, N, 1]
        pooled_tasks = (task_embs * attn_weights).sum(dim=1)       # [B, 64]
        
        # 2. Process Global and User
        glob_emb = self.global_mlp(global_feats) # [B, 32]
        user_emb = self.user_mlp(user_feats)     # [B, 32]
        
        # 3. Concat and Project
        context = torch.cat([pooled_tasks, glob_emb, user_emb], dim=-1) # [B, 128]
        return self.final_proj(context) # [B, features_dim]


# ---------------------------------------------------------------------------
# Training Loop
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--steps", type=int, default=100000, help="Timesteps to train")
    p.add_argument("--batch-size", type=int, default=64, help="PPO Batch Size")
    p.add_argument("--lr", type=float, default=3e-4, help="Learning Rate")
    p.add_argument("--gamma", type=float, default=0.99, help="Discount factor")
    p.add_argument("--output", type=str, default="./models", help="Model save dir")
    return p.parse_args()


def main():
    args = parse_args()
    
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print("Initiating FAANG-Level PPO Scheduler Training")
    print(f"{'='*60}")
    print(f"Steps:  {args.steps}")
    print(f"Batch:  {args.batch_size}")
    print(f"LR:     {args.lr}")
    print(f"Output: {out_dir}\n")

    # 1. Initialize Environments
    # We use SB3's Monitor to log episodic rewards natively for TensorBoard
    def make_env(seed):
        def _init():
            env = AdvancedSchedulingEnv(seed=seed)
            return Monitor(env)
        return _init

    train_env = DummyVecEnv([make_env(42), make_env(43), make_env(44), make_env(45)])
    eval_env = DummyVecEnv([make_env(999)])

    # 2. Configure PPO Policy with Custom Extractor
    policy_kwargs = dict(
        features_extractor_class=SchedulingFeatureExtractor,
        features_extractor_kwargs=dict(features_dim=256),
        net_arch=[256, 128] # Policy and Value head network sizes
    )

    # 3. Initialize MaskablePPO (sb3-contrib)
    # MaskablePPO automatically calls env.action_masks() to enforce valid paths
    model = MaskablePPO(
        MaskableMultiInputActorCriticPolicy,
        train_env,
        learning_rate=args.lr,
        n_steps=1024,
        batch_size=args.batch_size,
        gamma=args.gamma,
        policy_kwargs=policy_kwargs,
        tensorboard_log=str(out_dir / "tb_logs"),
        verbose=1
    )

    # 4. Evaluation Callback
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(out_dir),
        log_path=str(out_dir),
        eval_freq=10000 // train_env.num_envs,
        deterministic=True,
        render=False
    )

    # 5. Execute Training
    try:
        print("Starting training loop... (this will use GPU if PyTorch finds one)")
        model.learn(total_timesteps=args.steps, callback=eval_callback, progress_bar=True)
        print("\n✅ Training Complete!")
        
        final_path = out_dir / "ppo_scheduler_final"
        model.save(str(final_path))
        print(f"💾 Saved final model to {final_path}.zip")
        
    except KeyboardInterrupt:
        print("\n⚠️ Training interrupted by user. Saving checkpoint...")
        model.save(str(out_dir / "ppo_scheduler_interrupted"))

if __name__ == "__main__":
    main()
