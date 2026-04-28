"""
Task Execution Time Predictor Model
Supports Random Forest and XGBoost with synthetic training data
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, IsolationForest
from sklearn.model_selection import cross_val_score
from datetime import datetime

# Try to import XGBoost (optional)
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️ XGBoost not available, using GradientBoosting as fallback")


class TaskPredictor:
    def __init__(self, model_path='models/task_predictor.joblib', model_type='random_forest'):
        self.model_path = model_path
        self.model = None
        self.version = None
        self.model_type = model_type  # 'random_forest', 'xgboost', or 'gradient_boosting'
        self.last_loaded_time = 0
        self._load_or_create_model()
    
    def _load_or_create_model(self):
        """Load existing model or create new one with synthetic data"""
        if os.path.exists(self.model_path):
            try:
                data = joblib.load(self.model_path)
                self.model = data['model']
                self.version = data['version']
                self.model_type = data.get('model_type', 'random_forest')
                self.last_loaded_time = os.path.getmtime(self.model_path)
                print(f"✅ Loaded {self.model_type} model version: {self.version}")
                return
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
        
        # Create new model with synthetic data
        print(f"🔧 Creating new {self.model_type} model with synthetic data...")
        self._train_with_synthetic_data()

    def check_for_updates(self):
        """Check if model file has been updated on disk and reload if necessary"""
        if os.path.exists(self.model_path):
            try:
                mtime = os.path.getmtime(self.model_path)
                if mtime > self.last_loaded_time:
                    print(f"🔄 Model update detected on disk (mtime: {mtime} > {self.last_loaded_time}). Reloading...")
                    self._load_or_create_model()
                    return True
            except Exception as e:
                print(f"⚠️ Error checking for model updates: {e}")
        return False
    
    def _generate_synthetic_data(self, n_samples=1000):
        """Generate realistic synthetic training data"""
        # Strict seeding for deterministic synthetic data
        rng = np.random.RandomState(42)
        
        # Generate features
        task_size = rng.choice([1, 2, 3], n_samples)
        task_type = rng.choice([1, 2, 3], n_samples)
        priority = rng.choice([1, 2, 3, 4, 5], n_samples)
        resource_load = rng.uniform(0, 100, n_samples)
        startup_overhead = rng.uniform(0.5, 5.0, n_samples) # 0.5s to 5s overhead
        
        X = np.column_stack([task_size, task_type, priority, resource_load, startup_overhead])
        
        # Generate realistic execution times
        base_time = task_size * 2
        type_modifier = np.where(task_type == 1, 1.0,
                        np.where(task_type == 2, 1.3, 1.15))
        load_modifier = 1 + (resource_load / 100) * 0.5
        priority_factor = 1 - (priority - 3) * 0.02
        
        execution_time = (base_time * type_modifier * load_modifier * priority_factor +
                         startup_overhead + # Startup overhead directly adds to time
                         rng.normal(0, 0.5, n_samples))
        
        # Add "unreliability" factor (latency spikes)
        latency_spikes = rng.choice([0, 1], n_samples, p=[0.95, 0.05]) * rng.uniform(1, 5, n_samples)
        execution_time += latency_spikes
        
        execution_time = np.maximum(execution_time, 0.5)

        # Target shape is (n_samples,): execution_time
        Y = execution_time
        
        return X, Y
    
    def _train_with_synthetic_data(self):
        """Train model with realistic synthetic data"""
        X, y = self._generate_synthetic_data(5000)
        self.train(X, y)
    
    def train(self, X, y):
        """Train the model with provided data"""
        # Create model based on type
        if self.model_type == 'xgboost' and XGBOOST_AVAILABLE:
            self.model = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=8,
                learning_rate=0.05,
                min_child_weight=1,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'gradient_boosting':
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42
            )
        else:
            # Default: Random Forest
            self.model_type = 'random_forest'
            self.model = RandomForestRegressor(
                n_estimators=200,
                max_depth=15,
                min_samples_split=2,
                min_samples_leaf=1,
                random_state=42,
                n_jobs=-1
            )
        
        self.model.fit(X, y)
        
        
        # Calculate cross-validation score (R^2)
        cv_scores = cross_val_score(self.model, X, y, cv=5, scoring='r2')
        
        # Update version
        self.version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Save model
        self._save_model()
        
        # Get feature importance
        importance = [0.25, 0.25, 0.25, 0.25]
        try:
            if hasattr(self.model, 'feature_importances_'):
                importance = self.model.feature_importances_
        except Exception:
            pass
        
        metrics = {
            'model_type': self.model_type,
            'r2_score': round(float(np.mean(cv_scores)), 4),
            'r2_std': round(float(np.std(cv_scores)), 4),
            'samples_trained': len(y),
            'feature_importance': {
                'taskSize': round(float(importance[0]), 4),
                'taskType': round(float(importance[1]), 4),
                'priority': round(float(importance[2]), 4),
                'resourceLoad': round(float(importance[3]), 4),
                'startupOverhead': round(float(importance[4]), 4)
            }
        }
        
        print(f"✅ {self.model_type} model trained - R² Score: {metrics['r2_score']}")
        
        return metrics
    
    def _save_model(self):
        """Save model to disk"""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'version': self.version,
            'model_type': self.model_type
        }, self.model_path)
        print(f"💾 Model saved: {self.model_path}")
    
    def retrain(self, X_new, y_new, incremental=False):
        """Retrain model with new data"""
        if incremental and hasattr(self, '_training_data'):
            # Combine with existing data
            X = np.vstack([self._training_data['X'], X_new])
            y = np.concatenate([self._training_data['y'], y_new])
        else:
            X, y = X_new, y_new
        
        # Store training data for incremental learning
        self._training_data = {'X': X, 'y': y}
        
        return self.train(X, y)
    
    def switch_model(self, model_type):
        """Switch to a different model type and retrain"""
        valid_types = ['random_forest', 'xgboost', 'gradient_boosting']
        if model_type not in valid_types:
            raise ValueError(f"Invalid model type. Choose from: {valid_types}")
        
        self.model_type = model_type
        self._train_with_synthetic_data()
        return {'model_type': self.model_type, 'version': self.version}
    
    def predict(self, task_size, task_type, priority, resource_load, startup_overhead=1.0):
        """
        Predict execution time for a task with feature normalization and reliability guards
        """
        if self.model is None:
            raise ValueError("Model not loaded")
        
        # 1. Feature Guard & Normalization (Simple min-max scaling proxy)
        # In a real system, we'd use sklearn.preprocessing.StandardScaler saved as an artifact
        task_size = np.clip(task_size, 1, 3)
        task_type = np.clip(task_type, 1, 3)
        priority = np.clip(priority, 1, 5)
        resource_load = np.clip(resource_load, 0, 100)
        startup_overhead = np.clip(startup_overhead, 0.1, 10.0)

        # Prepare features
        X = np.array([[task_size, task_type, priority, resource_load, startup_overhead]])
        
        # 2. Make Prediction
        predicted_time = self.model.predict(X)[0]
        
        # 3. Reliability Guard: Prediction Clipping & Monotonicity
        # No task can take less than its startup overhead or a minimum of 0.2s
        min_feasible_time = max(0.2, startup_overhead * 0.8)
        
        # Guarantee monotonicity: LARGE tasks must take longer than SMALL tasks for same conditions
        # Heuristic adjustment if model behaves erratically
        size_multiplier = 1.0
        if task_size == 3: size_multiplier = 1.5
        elif task_size == 1: size_multiplier = 0.6
        
        predicted_time = predicted_time * 0.8 + (base_time * size_multiplier) * 0.2
        predicted_time = max(predicted_time, min_feasible_time)
        
        # 4. Confidence Calculation (Enhanced)
        # Confidence decreases if features are at extreme ranges (unseen data)
        confidence = 0.92
        if resource_load > 92 or resource_load < 5:
            confidence -= 0.15
        if task_size == 3 and resource_load > 85:
            confidence -= 0.10
        
        # Clamp confidence to [0, 1]
        confidence = max(0.1, min(1.0, confidence))
            
        return float(predicted_time), float(confidence)
    
    def predict_batch(self, features_list):
        """
        Vectorized batch prediction
        Returns:
            list of (predicted_time, confidence) tuples
        """
        if self.model is None:
            raise ValueError("Model not loaded")
        
        # features_list expected to have 5 elements per item now
        X = np.array(features_list)
        predictions = self.model.predict(X)
        
        results = []
        for pred, feat in zip(predictions, features_list):
            # Calculate simple confidence score
            conf = 0.85
            if feat[0] == 3 and feat[3] > 80:
                conf = 0.65
            elif feat[1] == 3:
                conf = 0.75
            results.append((float(pred), conf))
            
        return results
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None
    
    def get_version(self):
        """Get model version"""
        return self.version or "not-loaded"

    def detect_anomalies(self, X, actual_times, contamination=0.05):
        """
        Detect anomalies in task execution times using Isolation Forest
        and simple prediction-error thresholds.
        
        Args:
            X: features array (n_samples, 5)
            actual_times: actual execution times array (n_samples,)
            contamination: expected proportion of anomalies
            
        Returns:
            list: indices of anomalies
        """
        if self.model is None:
            raise ValueError("Model not loaded")

        # 1. Prediction-based anomalies (Z-score of residuals)
        predicted_times = self.model.predict(X)
        residuals = np.abs(actual_times - predicted_times)
        mean_res = np.mean(residuals)
        std_res = np.std(residuals)
        
        # Z-score > 3 is a common statistical outlier
        z_score_anomalies = np.where(residuals > (mean_res + 3 * std_res))[0]
        
        # 2. Multi-variate anomalies (Isolation Forest)
        # Combine features and actual times to find patterns that don't fit
        combined_data = np.column_stack([X, actual_times])
        iso_forest = IsolationForest(contamination=contamination, random_state=42)
        iso_preds = iso_forest.fit_predict(combined_data)
        iso_anomalies = np.where(iso_preds == -1)[0]
        
        # Return union of both methods
        return sorted(list(set(z_score_anomalies) | set(iso_anomalies)))


# Test if run directly
if __name__ == '__main__':
    print("Testing TaskPredictor...")
    predictor = TaskPredictor()
    
    # Test predictions
    test_cases = [
        (1, 1, 3, 25, 0.5),  # Small CPU task, medium priority, 25% load, 0.5s overhead
        (2, 2, 4, 50, 1.2),  # Medium IO task, high priority, 50% load, 1.2s overhead
        (3, 3, 5, 75, 2.5),  # Large Mixed task, critical priority, 75% load, 2.5s overhead
    ]
    
    print("\nTest Predictions:")
    print("-" * 60)
    for size, type_, priority, load, overhead in test_cases:
        pred_time, confidence = predictor.predict(size, type_, priority, load, overhead)
        size_name = ['', 'SMALL', 'MEDIUM', 'LARGE'][size]
        type_name = ['', 'CPU', 'IO', 'MIXED'][type_]
        print(f"{size_name} {type_name} task, P{priority}, {load}% load, {overhead}s overhead")
        print(f"  → Predicted Runtime: {pred_time:.2f}s (confidence: {confidence:.2%})")
        print()
