"""
Task Execution Time Predictor Model
Supports Random Forest and XGBoost with synthetic training data
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
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
        self._load_or_create_model()
    
    def _load_or_create_model(self):
        """Load existing model or create new one with synthetic data"""
        if os.path.exists(self.model_path):
            try:
                data = joblib.load(self.model_path)
                self.model = data['model']
                self.version = data['version']
                self.model_type = data.get('model_type', 'random_forest')
                print(f"✅ Loaded {self.model_type} model version: {self.version}")
                return
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
        
        # Create new model with synthetic data
        print(f"🔧 Creating new {self.model_type} model with synthetic data...")
        self._train_with_synthetic_data()
    
    def _generate_synthetic_data(self, n_samples=1000):
        """Generate realistic synthetic training data"""
        np.random.seed(42)
        
        # Generate features
        task_size = np.random.choice([1, 2, 3], n_samples)
        task_type = np.random.choice([1, 2, 3], n_samples)
        priority = np.random.choice([1, 2, 3, 4, 5], n_samples)
        resource_load = np.random.uniform(0, 100, n_samples)
        
        X = np.column_stack([task_size, task_type, priority, resource_load])
        
        # Generate realistic execution times
        base_time = task_size * 2
        type_modifier = np.where(task_type == 1, 1.0,
                        np.where(task_type == 2, 1.3, 1.15))
        load_modifier = 1 + (resource_load / 100) * 0.5
        priority_factor = 1 - (priority - 3) * 0.02
        
        execution_time = (base_time * type_modifier * load_modifier * priority_factor +
                         np.random.normal(0, 0.5, n_samples))
        execution_time = np.maximum(execution_time, 0.5)
        
        return X, execution_time
    
    def _train_with_synthetic_data(self):
        """Train model with realistic synthetic data"""
        X, y = self._generate_synthetic_data(1000)
        self.train(X, y)
    
    def train(self, X, y):
        """Train the model with provided data"""
        # Create model based on type
        if self.model_type == 'xgboost' and XGBOOST_AVAILABLE:
            self.model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                min_child_weight=2,
                subsample=0.8,
                colsample_bytree=0.8,
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
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
        
        self.model.fit(X, y)
        
        # Calculate cross-validation score
        cv_scores = cross_val_score(self.model, X, y, cv=5, scoring='r2')
        
        # Update version
        self.version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Save model
        self._save_model()
        
        # Get feature importance
        if hasattr(self.model, 'feature_importances_'):
            importance = self.model.feature_importances_
        else:
            importance = [0.25, 0.25, 0.25, 0.25]  # Default if not available
        
        metrics = {
            'model_type': self.model_type,
            'r2_score': round(float(np.mean(cv_scores)), 4),
            'r2_std': round(float(np.std(cv_scores)), 4),
            'samples_trained': len(y),
            'feature_importance': {
                'taskSize': round(float(importance[0]), 4),
                'taskType': round(float(importance[1]), 4),
                'priority': round(float(importance[2]), 4),
                'resourceLoad': round(float(importance[3]), 4)
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
    
    def predict(self, task_size, task_type, priority, resource_load):
        """
        Predict execution time for a task
        
        NOTE: This is a proof-of-concept trained on synthetic data.
        Production use requires real execution data for meaningful predictions.
        
        Returns:
            tuple: (predicted_time, confidence)
        """
        if self.model is None:
            raise ValueError("Model not loaded")
        
        # Prepare features
        X = np.array([[task_size, task_type, priority, resource_load]])
        
        # Get prediction
        predicted_time = self.model.predict(X)[0]
        
        # Calculate confidence using prediction variance across trees
        try:
            if hasattr(self.model, 'estimators_'):
                # Works for RandomForest and GradientBoosting
                estimators = self.model.estimators_
                if isinstance(estimators, np.ndarray):
                    # GradientBoosting: estimators_ is a 2D array of trees
                    tree_predictions = np.array([e[0].predict(X)[0] for e in estimators])
                else:
                    # RandomForest: estimators_ is a list of trees
                    tree_predictions = np.array([tree.predict(X)[0] for tree in estimators])
                variance = np.var(tree_predictions)
                confidence = 1.0 / (1.0 + variance)
            else:
                # Fallback for models without estimators_ (e.g., XGBoost)
                confidence = 0.75  # Default moderate confidence
        except Exception:
            confidence = 0.75
        
        confidence = min(0.99, max(0.5, confidence))  # Clamp between 0.5 and 0.99
        
        return float(predicted_time), float(confidence)
    
    def predict_batch(self, features_list):
        """
        Vectorized batch prediction — predict for many tasks in a single call.
        
        Args:
            features_list: list of [task_size, task_type, priority, resource_load]
        
        Returns:
            list of (predicted_time, confidence) tuples
        """
        if self.model is None:
            raise ValueError("Model not loaded")
        
        X = np.array(features_list)
        predictions = self.model.predict(X)
        
        # Vectorized confidence via tree prediction variance
        confidences = np.full(len(X), 0.75)  # default
        try:
            if hasattr(self.model, 'estimators_'):
                estimators = self.model.estimators_
                if isinstance(estimators, np.ndarray):
                    tree_preds = np.array([e[0].predict(X) for e in estimators])
                else:
                    tree_preds = np.array([tree.predict(X) for tree in estimators])
                variances = np.var(tree_preds, axis=0)
                confidences = 1.0 / (1.0 + variances)
        except Exception:
            pass
        
        confidences = np.clip(confidences, 0.5, 0.99)
        
        return [(float(p), float(c)) for p, c in zip(predictions, confidences)]
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None
    
    def get_version(self):
        """Get model version"""
        return self.version or "not-loaded"


# Test if run directly
if __name__ == '__main__':
    print("Testing TaskPredictor...")
    predictor = TaskPredictor()
    
    # Test predictions
    test_cases = [
        (1, 1, 3, 25),  # Small CPU task, medium priority, 25% load
        (2, 2, 4, 50),  # Medium IO task, high priority, 50% load
        (3, 3, 5, 75),  # Large Mixed task, critical priority, 75% load
    ]
    
    print("\nTest Predictions:")
    print("-" * 60)
    for size, type_, priority, load in test_cases:
        pred_time, confidence = predictor.predict(size, type_, priority, load)
        size_name = ['', 'SMALL', 'MEDIUM', 'LARGE'][size]
        type_name = ['', 'CPU', 'IO', 'MIXED'][type_]
        print(f"{size_name} {type_name} task, P{priority}, {load}% load")
        print(f"  → Predicted: {pred_time:.2f}s (confidence: {confidence:.2%})")
        print()
