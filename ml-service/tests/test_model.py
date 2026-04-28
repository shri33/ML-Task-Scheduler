"""
ML Model Unit Tests
Tests prediction pipeline correctness, batch prediction guards,
and edge case handling.
"""

import sys
import os
import numpy as np
import pytest

# Add parent directory to path so we can import model
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import TaskPredictor


@pytest.fixture
def predictor():
    """Create a fresh predictor for each test."""
    return TaskPredictor(model_path='models/test_predictor.joblib', model_type='random_forest')


class TestSinglePrediction:
    """Tests for the predict() method."""

    def test_predict_returns_tuple(self, predictor):
        time, conf = predictor.predict(2, 1, 3, 50, 1.0)
        assert isinstance(time, float)
        assert isinstance(conf, float)

    def test_predict_positive_time(self, predictor):
        """Predictions must always be positive."""
        time, _ = predictor.predict(1, 1, 1, 0, 0.5)
        assert time > 0

    def test_predict_confidence_range(self, predictor):
        """Confidence must be in [0.1, 1.0]."""
        for size in [1, 2, 3]:
            for load in [0, 50, 100]:
                _, conf = predictor.predict(size, 1, 3, load, 1.0)
                assert 0.1 <= conf <= 1.0, f"Confidence {conf} out of range for size={size}, load={load}"

    def test_monotonicity_size(self, predictor):
        """LARGE tasks must take >= SMALL tasks under same conditions."""
        time_small, _ = predictor.predict(1, 1, 3, 50, 1.0)
        time_large, _ = predictor.predict(3, 1, 3, 50, 1.0)
        assert time_large >= time_small, f"Monotonicity violated: LARGE({time_large}) < SMALL({time_small})"

    def test_feasibility_guard(self, predictor):
        """Predicted time must be >= min_feasible_time."""
        time, _ = predictor.predict(1, 1, 1, 0, 2.0)
        min_feasible = max(0.2, 2.0 * 0.8)
        assert time >= min_feasible, f"Time {time} < min feasible {min_feasible}"

    def test_clipping_extreme_inputs(self, predictor):
        """Out-of-range inputs should be clipped, not crash."""
        time, conf = predictor.predict(99, 99, 99, 999, 100)
        assert isinstance(time, float)
        assert time > 0

    def test_no_nan_outputs(self, predictor):
        """Predictions must never be NaN."""
        for size in [1, 2, 3]:
            for ttype in [1, 2, 3]:
                for pri in [1, 3, 5]:
                    time, conf = predictor.predict(size, ttype, pri, 50, 1.0)
                    assert not np.isnan(time), f"NaN time for ({size},{ttype},{pri})"
                    assert not np.isnan(conf), f"NaN confidence for ({size},{ttype},{pri})"

    def test_deterministic(self, predictor):
        """Same inputs must produce same outputs."""
        t1, c1 = predictor.predict(2, 2, 3, 50, 1.0)
        t2, c2 = predictor.predict(2, 2, 3, 50, 1.0)
        assert t1 == t2
        assert c1 == c2


class TestBatchPrediction:
    """Tests for the predict_batch() method."""

    def test_batch_returns_correct_count(self, predictor):
        features = [[1, 1, 3, 50, 1.0], [2, 2, 4, 70, 1.5], [3, 3, 5, 90, 2.0]]
        results = predictor.predict_batch(features)
        assert len(results) == 3

    def test_batch_consistency_with_single(self, predictor):
        """Batch predictions must match single predictions (same guards)."""
        features = [2, 1, 3, 50, 1.0]
        single_time, single_conf = predictor.predict(*features)
        batch_results = predictor.predict_batch([features])
        batch_time, batch_conf = batch_results[0]
        # Allow small floating point difference due to numpy vs python
        assert abs(single_time - batch_time) < 0.5, \
            f"Single({single_time}) vs Batch({batch_time}) differ too much"

    def test_batch_positive_times(self, predictor):
        features = [[s, t, p, l, 1.0] for s in [1,2,3] for t in [1,2,3] for p in [1,3,5] for l in [10,50,90]]
        results = predictor.predict_batch(features)
        for i, (time, _) in enumerate(results):
            assert time > 0, f"Batch item {i} has non-positive time: {time}"

    def test_batch_confidence_range(self, predictor):
        features = [[s, t, 3, l, 1.0] for s in [1,2,3] for t in [1,2,3] for l in [0,50,100]]
        results = predictor.predict_batch(features)
        for i, (_, conf) in enumerate(results):
            assert 0.1 <= conf <= 1.0, f"Batch item {i} confidence {conf} out of range"

    def test_batch_empty_raises(self, predictor):
        """Empty batch should raise ValueError (numpy can't create array)."""
        with pytest.raises((ValueError, IndexError)):
            predictor.predict_batch([])


class TestModelLifecycle:
    """Tests for model loading, training, and versioning."""

    def test_model_loaded(self, predictor):
        assert predictor.is_loaded()

    def test_model_has_version(self, predictor):
        version = predictor.get_version()
        assert version != "not-loaded"
        assert version.startswith("v")

    def test_train_returns_metrics(self, predictor):
        X, y = predictor._generate_synthetic_data(100)
        metrics = predictor.train(X, y)
        assert 'r2_score' in metrics
        assert 'model_type' in metrics
        assert metrics['r2_score'] > 0

    def test_switch_model(self, predictor):
        result = predictor.switch_model('gradient_boosting')
        assert result['model_type'] == 'gradient_boosting'


class TestAnomalyDetection:
    """Tests for the detect_anomalies method."""

    def test_anomaly_detection_runs(self, predictor):
        X, y = predictor._generate_synthetic_data(100)
        # Inject obvious anomalies
        y[0] = 999.0
        y[1] = 999.0
        anomalies = predictor.detect_anomalies(X, y, contamination=0.05)
        assert isinstance(anomalies, list)
        # The injected anomalies should be detected
        assert 0 in anomalies or 1 in anomalies


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
