"""
ML Model Accuracy Tests
========================
Validates that the TaskPredictor:
  • Trains without error
  • Achieves R² > 0.7 on synthetic data (sanity check)
  • Produces monotonic predictions (larger tasks → longer time)
  • Confidence values are in [0.5, 0.99]
  • Feature importance sums to ≈1.0
  • Retrain + switch_model work correctly

Run: python -m pytest ml-service/tests/test_model.py -v
"""

import sys
import os
import numpy as np
import pytest

# Ensure ml-service root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from model import TaskPredictor


@pytest.fixture(scope="module")
def predictor():
    """Create a fresh predictor with synthetic training data."""
    p = TaskPredictor(model_path="models/test_predictor.joblib", model_type="random_forest")
    return p


class TestModelTraining:
    def test_model_is_loaded(self, predictor: TaskPredictor):
        assert predictor.is_loaded(), "Model should be loaded after init"

    def test_version_is_set(self, predictor: TaskPredictor):
        v = predictor.get_version()
        assert v.startswith("v"), f"Version should start with 'v', got {v}"

    def test_train_returns_r2_above_threshold(self):
        """R² > 0.7 on synthetic data is a minimal sanity gate."""
        p = TaskPredictor(model_path="models/test_r2.joblib")
        X, y = p._generate_synthetic_data(500)
        metrics = p.train(X, y)
        assert metrics["r2_score"] > 0.7, f"R²={metrics['r2_score']} — too low for synthetic data"

    def test_feature_importance_sums_to_one(self):
        p = TaskPredictor(model_path="models/test_fi.joblib")
        X, y = p._generate_synthetic_data(500)
        metrics = p.train(X, y)
        total = sum(metrics["feature_importance"].values())
        assert abs(total - 1.0) < 0.01, f"Feature importance should sum to ~1.0, got {total}"


class TestPredictions:
    def test_prediction_returns_two_floats(self, predictor: TaskPredictor):
        time_val, conf = predictor.predict(2, 1, 3, 50.0)
        assert isinstance(time_val, float)
        assert isinstance(conf, float)

    def test_confidence_in_range(self, predictor: TaskPredictor):
        _, conf = predictor.predict(1, 1, 3, 25.0)
        assert 0.5 <= conf <= 0.99, f"Confidence {conf} out of [0.5, 0.99]"

    def test_larger_task_takes_longer(self, predictor: TaskPredictor):
        """SMALL < MEDIUM < LARGE for same conditions."""
        t_small, _ = predictor.predict(1, 1, 3, 50.0)
        t_medium, _ = predictor.predict(2, 1, 3, 50.0)
        t_large, _ = predictor.predict(3, 1, 3, 50.0)
        assert t_small < t_medium < t_large, (
            f"Expected SMALL({t_small}) < MEDIUM({t_medium}) < LARGE({t_large})"
        )

    def test_higher_load_increases_time(self, predictor: TaskPredictor):
        """Higher resource load should yield longer predicted time."""
        t_low, _ = predictor.predict(2, 1, 3, 10.0)
        t_high, _ = predictor.predict(2, 1, 3, 90.0)
        assert t_high > t_low, f"High-load({t_high}) should exceed low-load({t_low})"

    def test_predicted_time_positive(self, predictor: TaskPredictor):
        for size in [1, 2, 3]:
            for ttype in [1, 2, 3]:
                t, _ = predictor.predict(size, ttype, 3, 50)
                assert t > 0, f"Predicted time must be positive, got {t}"


class TestModelSwitching:
    def test_switch_model_to_gradient_boosting(self):
        p = TaskPredictor(model_path="models/test_switch.joblib")
        result = p.switch_model("gradient_boosting")
        assert result["model_type"] == "gradient_boosting"
        assert p.is_loaded()

    def test_switch_model_invalid_raises(self):
        p = TaskPredictor(model_path="models/test_switch2.joblib")
        with pytest.raises(ValueError):
            p.switch_model("invalid_model")


class TestRetrain:
    def test_retrain_updates_version(self):
        p = TaskPredictor(model_path="models/test_retrain.joblib")
        old_version = p.get_version()
        X = np.array([[1, 1, 3, 25], [2, 2, 4, 50], [3, 3, 5, 75],
                       [1, 2, 2, 30], [2, 1, 4, 60]])
        y = np.array([2.0, 4.5, 8.0, 3.0, 5.5])
        p.retrain(X, y)
        assert p.get_version() != old_version, "Version should change after retrain"


# Cleanup test model files after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    import glob
    for f in glob.glob("models/test_*.joblib"):
        try:
            os.remove(f)
        except OSError:
            pass
