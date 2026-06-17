"""
ML Prediction Models for Fog Scheduling Simulation
====================================================
Production-grade prediction pipeline for:
  - Execution time prediction
  - Queue wait time prediction
  - Transfer time prediction
  - Energy consumption prediction
  - Failure probability prediction
  - Congestion prediction

Uses:
  - XGBoost (primary)
  - LightGBM
  - Random Forest
  - Feature engineering pipeline
  - Online inference with caching
"""

import os
import json
import time
import hashlib
import logging
import threading
from typing import Dict, List, Optional, Tuple, Any

import numpy as np

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import joblib

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------

FEATURE_NAMES = [
    'node_cpu_util',          # 0: CPU utilization of target node (0-1)
    'node_mem_util',          # 1: Memory utilization (0-1)
    'node_vram_util',         # 2: VRAM utilization (0-1)
    'node_queue_length',      # 3: Current queue length
    'node_queue_util',        # 4: Queue utilization ρ (0-1)
    'node_tier',              # 5: Node tier (0=device, 1=edge, 2=fog, 3=cloud)
    'node_cpu_freq',          # 6: CPU frequency GHz
    'node_cpu_cores',         # 7: CPU core count
    'task_cpu_req',           # 8: Task CPU requirement
    'task_mem_req',           # 9: Task memory requirement MB
    'task_vram_req',          # 10: Task VRAM requirement MB
    'task_data_size',         # 11: Task data size MB
    'task_priority',          # 12: Task priority (1-5)
    'task_category',          # 13: Task category (0=CPU, 1=GPU)
    'topology_distance',      # 14: Hop count origin→target
    'link_latency',           # 15: Path latency ms
    'link_bandwidth',         # 16: Bottleneck bandwidth Mbps
    'link_utilization',       # 17: Average link utilization on path (0-1)
    'link_packet_loss',       # 18: Average packet loss rate
    'historical_exec_mean',   # 19: Mean exec time for similar tasks
    'historical_exec_std',    # 20: Std dev of exec time
    'retry_count',            # 21: Number of retries so far
]

NUM_FEATURES = len(FEATURE_NAMES)


def extract_features(
    node_state: Dict[str, Any],
    task: Dict[str, Any],
    path_info: Dict[str, Any],
    historical: Dict[str, Any],
) -> np.ndarray:
    """Extract feature vector from simulation state."""
    tier_map = {'DEVICE': 0, 'EDGE': 1, 'FOG': 2, 'CLOUD': 3}

    features = np.zeros(NUM_FEATURES, dtype=np.float32)
    features[0] = node_state.get('cpu_util', 0)
    features[1] = node_state.get('mem_util', 0)
    features[2] = node_state.get('vram_util', 0)
    features[3] = node_state.get('queue_length', 0)
    features[4] = node_state.get('queue_util', 0)
    features[5] = tier_map.get(node_state.get('tier', 'EDGE'), 1)
    features[6] = node_state.get('cpu_freq', 2.0)
    features[7] = node_state.get('cpu_cores', 4)
    features[8] = task.get('cpu_req', 1)
    features[9] = task.get('mem_req', 256)
    features[10] = task.get('vram_req', 0)
    features[11] = task.get('data_size', 10)
    features[12] = task.get('priority', 3)
    features[13] = task.get('category', 0)
    features[14] = path_info.get('hops', 1)
    features[15] = path_info.get('latency_ms', 10)
    features[16] = path_info.get('bandwidth_mbps', 1000)
    features[17] = path_info.get('link_util', 0.3)
    features[18] = path_info.get('packet_loss', 0.001)
    features[19] = historical.get('exec_mean', 10)
    features[20] = historical.get('exec_std', 5)
    features[21] = task.get('retry_count', 0)

    return features


# ---------------------------------------------------------------------------
# Prediction Target Models
# ---------------------------------------------------------------------------

class PredictionModel:
    """Base class for all prediction models."""

    def __init__(self, name: str, model_type: str = 'xgboost'):
        self.name = name
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_importance: Optional[np.ndarray] = None
        self._lock = threading.Lock()

    def train(self, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        """Train the model and return metrics."""
        with self._lock:
            X_scaled = self.scaler.fit_transform(X)

            if self.model_type == 'xgboost' and HAS_XGBOOST:
                self.model = xgb.XGBRegressor(
                    n_estimators=200,
                    max_depth=8,
                    learning_rate=0.05,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_alpha=0.1,
                    reg_lambda=1.0,
                    n_jobs=-1,
                    random_state=42,
                )
            elif self.model_type == 'lightgbm' and HAS_LIGHTGBM:
                self.model = lgb.LGBMRegressor(
                    n_estimators=200,
                    max_depth=8,
                    learning_rate=0.05,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_alpha=0.1,
                    reg_lambda=1.0,
                    n_jobs=-1,
                    random_state=42,
                    verbose=-1,
                )
            elif self.model_type == 'gradient_boosting':
                self.model = GradientBoostingRegressor(
                    n_estimators=200,
                    max_depth=6,
                    learning_rate=0.05,
                    subsample=0.8,
                    random_state=42,
                )
            else:
                # Fallback: Random Forest
                self.model = RandomForestRegressor(
                    n_estimators=200,
                    max_depth=10,
                    min_samples_split=5,
                    min_samples_leaf=2,
                    n_jobs=-1,
                    random_state=42,
                )

            self.model.fit(X_scaled, y)
            self.is_fitted = True

            # Feature importance
            if hasattr(self.model, 'feature_importances_'):
                self.feature_importance = self.model.feature_importances_

            # Cross-validation score
            cv_scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring='neg_mean_absolute_error')
            mae = -cv_scores.mean()
            mae_std = cv_scores.std()

            # R² score
            r2_scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring='r2')
            r2 = r2_scores.mean()

            return {
                'mae': float(mae),
                'mae_std': float(mae_std),
                'r2': float(r2),
                'num_samples': int(X.shape[0]),
                'num_features': int(X.shape[1]),
            }

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict for one or more samples."""
        if not self.is_fitted:
            raise RuntimeError(f"Model '{self.name}' is not fitted")

        with self._lock:
            X_scaled = self.scaler.transform(X)
            predictions = self.model.predict(X_scaled)
            return np.maximum(0, predictions)  # Clamp to non-negative

    def predict_single(self, features: np.ndarray) -> float:
        """Predict for a single feature vector."""
        return float(self.predict(features.reshape(1, -1))[0])

    def save(self, path: str) -> None:
        """Save model to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'name': self.name,
            'model_type': self.model_type,
            'feature_importance': self.feature_importance,
        }, path)
        logger.info(f"Model '{self.name}' saved to {path}")

    def load(self, path: str) -> None:
        """Load model from disk."""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.name = data['name']
        self.model_type = data.get('model_type', 'random_forest')
        self.feature_importance = data.get('feature_importance')
        self.is_fitted = True
        logger.info(f"Model '{self.name}' loaded from {path}")

    def get_feature_importance(self) -> Dict[str, float]:
        """Return feature importance as name→value dict."""
        if self.feature_importance is None:
            return {}
        return {
            FEATURE_NAMES[i]: float(self.feature_importance[i])
            for i in range(min(len(FEATURE_NAMES), len(self.feature_importance)))
        }


# ---------------------------------------------------------------------------
# Model Manager (Singleton)
# ---------------------------------------------------------------------------

class SimulationModelManager:
    """
    Manages all prediction models for the simulation.
    Models are loaded ONCE at startup and cached.
    Thread-safe for concurrent inference.
    """

    def __init__(self, model_dir: str = 'models/simulation'):
        self.model_dir = model_dir
        self.models: Dict[str, PredictionModel] = {}
        self._lock = threading.Lock()
        self._prediction_cache: Dict[str, Tuple[float, float]] = {}  # hash → (prediction, timestamp)
        self._cache_ttl = 60  # seconds
        self._initialized = False

    def initialize(self, model_type: str = 'random_forest') -> None:
        """Initialize all prediction models."""
        with self._lock:
            if self._initialized:
                return

            model_names = [
                'exec_time',
                'queue_wait',
                'transfer_time',
                'energy',
                'failure_prob',
                'congestion',
            ]

            for name in model_names:
                model = PredictionModel(name, model_type)
                model_path = os.path.join(self.model_dir, f'{name}.joblib')

                if os.path.exists(model_path):
                    try:
                        model.load(model_path)
                        logger.info(f"Loaded pre-trained model: {name}")
                    except Exception as e:
                        logger.warning(f"Failed to load model {name}: {e}")
                        self._train_default(model)
                else:
                    self._train_default(model)

                self.models[name] = model

            self._initialized = True
            logger.info(f"Model manager initialized with {len(self.models)} models")

    def _train_default(self, model: PredictionModel) -> None:
        """Train a model with synthetic training data."""
        rng = np.random.RandomState(42)
        n_samples = 5000

        X = rng.random((n_samples, NUM_FEATURES)).astype(np.float32)

        # Scale features to realistic ranges
        X[:, 0] *= 1.0       # cpu_util
        X[:, 1] *= 1.0       # mem_util
        X[:, 2] *= 1.0       # vram_util
        X[:, 3] *= 50        # queue_length
        X[:, 4] *= 1.0       # queue_util
        X[:, 5] = rng.choice([0, 1, 2, 3], n_samples)  # tier
        X[:, 6] = 1.0 + rng.random(n_samples) * 3      # cpu_freq
        X[:, 7] = rng.choice([2, 4, 8, 16, 32, 64], n_samples)  # cpu_cores
        X[:, 8] = rng.choice([1, 2, 4, 8], n_samples)   # task_cpu_req
        X[:, 9] = 128 + rng.random(n_samples) * 16000   # task_mem_req
        X[:, 10] = rng.choice([0, 0, 0, 1024, 2048, 4096, 8192], n_samples)  # vram
        X[:, 11] = 0.1 + rng.random(n_samples) * 500    # data_size
        X[:, 12] = rng.choice([1, 2, 3, 4, 5], n_samples)
        X[:, 13] = rng.choice([0, 1], n_samples)
        X[:, 14] = rng.choice([1, 2, 3, 4, 5], n_samples)  # hops
        X[:, 15] = 1 + rng.random(n_samples) * 200      # latency
        X[:, 16] = 10 + rng.random(n_samples) * 25000   # bandwidth
        X[:, 17] *= 1.0      # link_util
        X[:, 18] *= 0.05     # packet_loss
        X[:, 19] = 1 + rng.random(n_samples) * 100      # historical_mean
        X[:, 20] = 0.5 + rng.random(n_samples) * 50     # historical_std
        X[:, 21] = rng.choice([0, 0, 0, 1, 2, 3], n_samples)  # retry

        # Generate realistic target based on model name
        if model.name == 'exec_time':
            # exec ∝ task_cpu_req / (node_cores * freq) * (1 + queue_util)
            y = (X[:, 8] / (X[:, 7] * X[:, 6])) * (1 + X[:, 4]) * X[:, 19] * (1 + 0.2 * rng.randn(n_samples))
            y = np.maximum(0.01, y)

        elif model.name == 'queue_wait':
            # M/M/1: wait ∝ ρ/(1-ρ) * service_time
            rho = np.clip(X[:, 4], 0, 0.98)
            y = (rho / (1 - rho + 1e-6)) * (1 / (1 + X[:, 7])) * (1 + 0.3 * rng.randn(n_samples))
            y = np.maximum(0, y)

        elif model.name == 'transfer_time':
            # transfer ∝ data_size / bandwidth * (1 + packet_loss * 10) + latency * hops
            y = (X[:, 11] * 8 / (X[:, 16] + 1e-6)) * (1 + X[:, 18] * 10) + X[:, 15] * X[:, 14] / 1000
            y = np.maximum(0, y) * (1 + 0.2 * rng.randn(n_samples))

        elif model.name == 'energy':
            # energy ∝ power * time (power increases with CPU util)
            exec_time = (X[:, 8] / (X[:, 7] * X[:, 6])) * X[:, 19]
            power = 5 + (X[:, 5] + 1) * 50 * (0.3 + 0.7 * X[:, 0])
            y = power * np.maximum(0.01, exec_time) / 3600

        elif model.name == 'failure_prob':
            # failure ∝ (1 - device_tier/3) * retry_count * queue_util
            y = (1 - X[:, 5] / 3) * 0.01 * (1 + X[:, 21]) * (1 + X[:, 4] * 2)
            y = np.clip(y, 0, 1)

        elif model.name == 'congestion':
            # congestion flag: high when link_util > 0.8 and queue_util > 0.7
            y = (X[:, 17] * 0.5 + X[:, 4] * 0.3 + X[:, 0] * 0.2)
            y = np.clip(y, 0, 1)

        else:
            y = rng.random(n_samples) * 10

        metrics = model.train(X, y)
        logger.info(f"Trained default model '{model.name}': MAE={metrics['mae']:.4f}, R²={metrics['r2']:.4f}")

        # Save trained model
        try:
            model.save(os.path.join(self.model_dir, f'{model.name}.joblib'))
        except Exception as e:
            logger.warning(f"Failed to save model '{model.name}': {e}")

    def predict(
        self,
        model_name: str,
        features: np.ndarray,
        use_cache: bool = True,
    ) -> float:
        """Get a prediction from a named model."""
        if model_name not in self.models:
            raise ValueError(f"Unknown model: {model_name}")

        # Check cache
        if use_cache:
            cache_key = f"{model_name}:{hashlib.md5(features.tobytes()).hexdigest()}"
            cached = self._prediction_cache.get(cache_key)
            if cached and (time.time() - cached[1]) < self._cache_ttl:
                return cached[0]

        prediction = self.models[model_name].predict_single(features)

        if use_cache:
            self._prediction_cache[cache_key] = (prediction, time.time())

        return prediction

    def predict_batch(
        self,
        model_name: str,
        features_batch: np.ndarray,
    ) -> np.ndarray:
        """Batch prediction for efficiency."""
        if model_name not in self.models:
            raise ValueError(f"Unknown model: {model_name}")
        return self.models[model_name].predict(features_batch)

    def get_all_model_info(self) -> Dict[str, Any]:
        """Return info about all loaded models."""
        info = {}
        for name, model in self.models.items():
            info[name] = {
                'fitted': model.is_fitted,
                'model_type': model.model_type,
                'feature_importance': model.get_feature_importance(),
            }
        return info


# ---------------------------------------------------------------------------
# Singleton Instance
# ---------------------------------------------------------------------------

_manager_instance: Optional[SimulationModelManager] = None
_manager_lock = threading.Lock()


def get_model_manager(model_dir: str = 'models/simulation') -> SimulationModelManager:
    """Get or create the singleton model manager."""
    global _manager_instance
    if _manager_instance is None:
        with _manager_lock:
            if _manager_instance is None:
                _manager_instance = SimulationModelManager(model_dir)
                _manager_instance.initialize()
    return _manager_instance
