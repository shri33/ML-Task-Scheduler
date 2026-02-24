"""
Research-Grade ML Extensions
==============================
Production-ready modules for:
  1. Optuna Hyperparameter Tuning
  2. SHAP Feature Explainability
  3. Conformal Prediction Intervals
  4. Statistical Significance Testing (paired t-test)
  5. PPO Reinforcement Learning skeleton for dynamic scheduling

Usage:
    from research import HyperparameterTuner, SHAPExplainer, ConformalPredictor, compare_models_significance
"""

import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Optional imports — degrade gracefully
try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. Optuna Hyperparameter Tuning
# ---------------------------------------------------------------------------
class HyperparameterTuner:
    """
    Bayesian hyperparameter optimization using Optuna.
    Optimizes for R² via k-fold CV.

    Usage:
        tuner = HyperparameterTuner(X_train, y_train)
        best_params, best_score = tuner.tune(model_type='random_forest', n_trials=100)
    """

    def __init__(self, X: np.ndarray, y: np.ndarray, n_folds: int = 5, seed: int = 42):
        if not OPTUNA_AVAILABLE:
            raise ImportError("optuna is required: pip install optuna")
        self.X = X
        self.y = y
        self.n_folds = n_folds
        self.seed = seed

    def _objective_rf(self, trial: 'optuna.Trial') -> float:
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 500),
            'max_depth': trial.suggest_int('max_depth', 3, 20),
            'min_samples_split': trial.suggest_int('min_samples_split', 2, 20),
            'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 10),
            'max_features': trial.suggest_categorical('max_features', ['sqrt', 'log2', None]),
        }
        model = RandomForestRegressor(**params, random_state=self.seed, n_jobs=-1)
        scores = cross_val_score(model, self.X, self.y, cv=self.n_folds, scoring='r2')
        return float(np.mean(scores))

    def _objective_gb(self, trial: 'optuna.Trial') -> float:
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 500),
            'max_depth': trial.suggest_int('max_depth', 3, 15),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
            'min_samples_split': trial.suggest_int('min_samples_split', 2, 20),
            'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 10),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        }
        model = GradientBoostingRegressor(**params, random_state=self.seed)
        scores = cross_val_score(model, self.X, self.y, cv=self.n_folds, scoring='r2')
        return float(np.mean(scores))

    def _objective_xgb(self, trial: 'optuna.Trial') -> float:
        if not XGB_AVAILABLE:
            raise ImportError("xgboost required for XGBoost tuning")
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 500),
            'max_depth': trial.suggest_int('max_depth', 3, 15),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
            'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        }
        model = xgb.XGBRegressor(**params, random_state=self.seed, n_jobs=-1)
        scores = cross_val_score(model, self.X, self.y, cv=self.n_folds, scoring='r2')
        return float(np.mean(scores))

    def tune(self, model_type: str = 'random_forest', n_trials: int = 100) -> Tuple[Dict, float]:
        objectives = {
            'random_forest': self._objective_rf,
            'gradient_boosting': self._objective_gb,
            'xgboost': self._objective_xgb,
        }
        if model_type not in objectives:
            raise ValueError(f"Unsupported model_type: {model_type}")

        study = optuna.create_study(direction='maximize',
                                     study_name=f'tune_{model_type}',
                                     sampler=optuna.samplers.TPESampler(seed=self.seed))
        study.optimize(objectives[model_type], n_trials=n_trials, show_progress_bar=True)

        return study.best_params, study.best_value


# ---------------------------------------------------------------------------
# 2. SHAP Feature Explainability
# ---------------------------------------------------------------------------
class SHAPExplainer:
    """
    Compute SHAP values for model predictions.

    Usage:
        explainer = SHAPExplainer(model, X_train)
        shap_values = explainer.explain(X_test)
        summary = explainer.feature_summary()
    """

    FEATURE_NAMES = ['taskSize', 'taskType', 'priority', 'resourceLoad']

    def __init__(self, model, X_background: np.ndarray):
        if not SHAP_AVAILABLE:
            raise ImportError("shap is required: pip install shap")
        self.model = model
        # Use a small background set for efficiency
        if len(X_background) > 100:
            idx = np.random.choice(len(X_background), 100, replace=False)
            X_background = X_background[idx]
        self.explainer = shap.TreeExplainer(model)
        self._shap_values: Optional[np.ndarray] = None
        self._X: Optional[np.ndarray] = None

    def explain(self, X: np.ndarray) -> np.ndarray:
        """Compute SHAP values for given inputs."""
        self._X = X
        self._shap_values = self.explainer.shap_values(X)
        return self._shap_values

    def feature_summary(self) -> Dict[str, float]:
        """Mean absolute SHAP value per feature."""
        if self._shap_values is None:
            raise ValueError("Call explain() first")
        means = np.mean(np.abs(self._shap_values), axis=0)
        return {name: round(float(v), 4) for name, v in zip(self.FEATURE_NAMES, means)}

    def single_explanation(self, X_single: np.ndarray) -> Dict[str, float]:
        """SHAP values for a single prediction (for API response)."""
        sv = self.explainer.shap_values(X_single.reshape(1, -1))[0]
        return {name: round(float(v), 4) for name, v in zip(self.FEATURE_NAMES, sv)}


# ---------------------------------------------------------------------------
# 3. Conformal Prediction Intervals
# ---------------------------------------------------------------------------
class ConformalPredictor:
    """
    Split conformal prediction for uncertainty quantification.
    Provides calibrated prediction intervals with coverage guarantee.

    Usage:
        cp = ConformalPredictor(model, alpha=0.1)  # 90% coverage
        cp.calibrate(X_cal, y_cal)
        intervals = cp.predict_interval(X_test)
        # intervals: list of (lower, upper) tuples
    """

    def __init__(self, model, alpha: float = 0.1):
        """
        Args:
            model: A fitted sklearn-compatible model with .predict()
            alpha: Miscoverage rate (0.1 = 90% coverage)
        """
        self.model = model
        self.alpha = alpha
        self._quantile: Optional[float] = None

    def calibrate(self, X_cal: np.ndarray, y_cal: np.ndarray):
        """Calibrate using a held-out calibration set."""
        preds = self.model.predict(X_cal)
        residuals = np.abs(y_cal - preds)
        n = len(residuals)
        # Finite-sample correction: ceil((n+1)*(1-alpha)) / n quantile
        q_level = min(1.0, np.ceil((n + 1) * (1 - self.alpha)) / n)
        self._quantile = float(np.quantile(residuals, q_level))

    def predict_interval(self, X: np.ndarray) -> List[Tuple[float, float]]:
        """Return (lower, upper) prediction intervals."""
        if self._quantile is None:
            raise ValueError("Call calibrate() first")
        preds = self.model.predict(X)
        return [(float(p - self._quantile), float(p + self._quantile)) for p in preds]

    def get_width(self) -> float:
        """Half-width of the prediction interval."""
        if self._quantile is None:
            raise ValueError("Call calibrate() first")
        return self._quantile


# ---------------------------------------------------------------------------
# 4. Statistical Significance Testing
# ---------------------------------------------------------------------------
def compare_models_significance(
    model_a, model_b, X: np.ndarray, y: np.ndarray,
    n_folds: int = 5, seed: int = 42
) -> Dict[str, Any]:
    """
    Paired t-test comparing two models via k-fold CV.
    Returns p-value and whether the difference is significant at α=0.05.

    Usage:
        result = compare_models_significance(rf_model, gb_model, X, y)
        print(result['p_value'], result['significant'])
    """
    from scipy import stats

    kf = KFold(n_splits=n_folds, shuffle=True, random_state=seed)
    scores_a, scores_b = [], []

    for train_idx, val_idx in kf.split(X):
        X_tr, X_val = X[train_idx], X[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]

        model_a.fit(X_tr, y_tr)
        model_b.fit(X_tr, y_tr)

        scores_a.append(r2_score(y_val, model_a.predict(X_val)))
        scores_b.append(r2_score(y_val, model_b.predict(X_val)))

    t_stat, p_value = stats.ttest_rel(scores_a, scores_b)

    return {
        'model_a_mean_r2': round(float(np.mean(scores_a)), 4),
        'model_b_mean_r2': round(float(np.mean(scores_b)), 4),
        't_statistic': round(float(t_stat), 4),
        'p_value': round(float(p_value), 6),
        'significant': p_value < 0.05,
        'folds': n_folds,
    }


# ---------------------------------------------------------------------------
# 5. PPO Reinforcement Learning Skeleton for Dynamic Scheduling
# ---------------------------------------------------------------------------
class PPOSchedulerEnv:
    """
    Gym-compatible environment for task scheduling via PPO.

    State:  [task_size, task_type, priority, r1_load, r2_load, ..., rN_load]
    Action: resource index (0..N-1)
    Reward: -predicted_execution_time + bonus_for_low_load

    This is a *skeleton* — integrate with stable-baselines3 for training:
        from stable_baselines3 import PPO
        env = PPOSchedulerEnv(n_resources=4)
        model = PPO('MlpPolicy', env, verbose=1)
        model.learn(total_timesteps=50000)
    """

    def __init__(self, n_resources: int = 4, max_steps: int = 100):
        self.n_resources = n_resources
        self.max_steps = max_steps
        self.step_count = 0

        # Observation: 4 task features + N resource loads
        self.observation_space_shape = (4 + n_resources,)
        # Action: which resource to assign to
        self.action_space_n = n_resources

        self.resource_loads = np.zeros(n_resources)
        self._current_task: Optional[np.ndarray] = None

    def reset(self) -> np.ndarray:
        self.resource_loads = np.zeros(self.n_resources)
        self.step_count = 0
        self._current_task = self._sample_task()
        return self._get_obs()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        assert 0 <= action < self.n_resources
        task = self._current_task
        assert task is not None

        # Simulate execution: time depends on task size and resource load
        task_size, task_type, priority, _ = task
        load = self.resource_loads[action]

        exec_time = task_size * 2 * (1 + load / 100) + np.random.normal(0, 0.3)
        exec_time = max(0.5, exec_time)

        # Update resource load
        self.resource_loads[action] = min(100, load + 15)

        # Reward: negative execution time + small bonus for keeping loads balanced
        load_variance = np.var(self.resource_loads)
        reward = -exec_time - 0.01 * load_variance

        self.step_count += 1
        done = self.step_count >= self.max_steps
        self._current_task = self._sample_task() if not done else None

        info = {'exec_time': exec_time, 'resource_loads': self.resource_loads.copy()}
        return self._get_obs(), float(reward), done, info

    def _sample_task(self) -> np.ndarray:
        return np.array([
            np.random.choice([1, 2, 3]),      # taskSize
            np.random.choice([1, 2, 3]),      # taskType
            np.random.choice([1, 2, 3, 4, 5]),  # priority
            0,  # placeholder (not used in obs directly)
        ], dtype=np.float32)

    def _get_obs(self) -> np.ndarray:
        task_features = self._current_task[:3] if self._current_task is not None else np.zeros(3)
        # Normalize: sizes 1-3, types 1-3, priority 1-5
        norm_task = np.array([
            task_features[0] / 3.0,
            task_features[1] / 3.0,
            task_features[2] / 5.0,
        ])
        norm_loads = self.resource_loads / 100.0
        return np.concatenate([norm_task, [0.0], norm_loads]).astype(np.float32)
