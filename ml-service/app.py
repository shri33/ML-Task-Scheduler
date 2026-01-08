"""
ML Service for Task Scheduling System
Predicts task execution time using Random Forest Regression
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import numpy as np
from model import TaskPredictor

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize model
predictor = TaskPredictor()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'ml-prediction-service',
        'model_loaded': predictor.is_loaded(),
        'model_version': predictor.get_version()
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict task execution time
    
    Request body:
    {
        "taskSize": 1-3 (SMALL=1, MEDIUM=2, LARGE=3),
        "taskType": 1-3 (CPU=1, IO=2, MIXED=3),
        "priority": 1-5,
        "resourceLoad": 0-100
    }
    
    Response:
    {
        "predictedTime": float (seconds),
        "confidence": float (0-1),
        "modelVersion": string
    }
    """
    try:
        data = request.get_json()
        
        # Validate input
        required_fields = ['taskSize', 'taskType', 'priority', 'resourceLoad']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Extract features
        task_size = int(data['taskSize'])
        task_type = int(data['taskType'])
        priority = int(data['priority'])
        resource_load = float(data['resourceLoad'])
        
        # Validate ranges
        if task_size not in [1, 2, 3]:
            return jsonify({'error': 'taskSize must be 1, 2, or 3'}), 400
        if task_type not in [1, 2, 3]:
            return jsonify({'error': 'taskType must be 1, 2, or 3'}), 400
        if not 1 <= priority <= 5:
            return jsonify({'error': 'priority must be between 1 and 5'}), 400
        if not 0 <= resource_load <= 100:
            return jsonify({'error': 'resourceLoad must be between 0 and 100'}), 400
        
        # Make prediction
        predicted_time, confidence = predictor.predict(
            task_size, task_type, priority, resource_load
        )
        
        return jsonify({
            'predictedTime': round(predicted_time, 2),
            'confidence': round(confidence, 4),
            'modelVersion': predictor.get_version()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/train', methods=['POST'])
def train():
    """
    Train or retrain the model with new data
    
    Request body:
    {
        "data": [
            {
                "taskSize": 1-3,
                "taskType": 1-3,
                "priority": 1-5,
                "resourceLoad": 0-100,
                "actualTime": float
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if 'data' not in data or len(data['data']) < 10:
            return jsonify({'error': 'At least 10 data points required for training'}), 400
        
        training_data = data['data']
        
        # Prepare training data
        X = []
        y = []
        for item in training_data:
            X.append([
                item['taskSize'],
                item['taskType'],
                item['priority'],
                item['resourceLoad']
            ])
            y.append(item['actualTime'])
        
        # Train model
        metrics = predictor.train(np.array(X), np.array(y))
        
        return jsonify({
            'success': True,
            'message': 'Model trained successfully',
            'metrics': metrics,
            'modelVersion': predictor.get_version()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/model/info', methods=['GET'])
def model_info():
    """Get information about the current model"""
    return jsonify({
        'modelVersion': predictor.get_version(),
        'modelType': predictor.model_type,
        'isLoaded': predictor.is_loaded(),
        'features': ['taskSize', 'taskType', 'priority', 'resourceLoad'],
        'availableModels': ['random_forest', 'xgboost', 'gradient_boosting'],
        'description': 'Predicts task execution time based on task characteristics and resource load'
    })

@app.route('/api/model/switch', methods=['POST'])
def switch_model():
    """
    Switch to a different ML model type
    
    Request body:
    {
        "modelType": "random_forest" | "xgboost" | "gradient_boosting"
    }
    """
    try:
        data = request.get_json()
        model_type = data.get('modelType', 'random_forest')
        
        result = predictor.switch_model(model_type)
        
        return jsonify({
            'success': True,
            'message': f'Switched to {model_type} model',
            'modelType': result['model_type'],
            'modelVersion': result['version']
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/model/compare', methods=['POST'])
def compare_models():
    """
    Compare predictions from all available model types
    
    Request body:
    {
        "taskSize": 1-3,
        "taskType": 1-3,
        "priority": 1-5,
        "resourceLoad": 0-100
    }
    """
    try:
        data = request.get_json()
        
        task_size = int(data['taskSize'])
        task_type = int(data['taskType'])
        priority = int(data['priority'])
        resource_load = float(data['resourceLoad'])
        
        # Store current model type
        original_type = predictor.model_type
        
        results = {}
        model_types = ['random_forest', 'gradient_boosting']
        
        # Try XGBoost if available
        try:
            import xgboost
            model_types.append('xgboost')
        except ImportError:
            pass
        
        for model_type in model_types:
            try:
                predictor.switch_model(model_type)
                pred_time, confidence = predictor.predict(task_size, task_type, priority, resource_load)
                results[model_type] = {
                    'predictedTime': round(pred_time, 2),
                    'confidence': round(confidence, 4)
                }
            except Exception as e:
                results[model_type] = {'error': str(e)}
        
        # Restore original model
        predictor.switch_model(original_type)
        
        return jsonify({
            'success': True,
            'input': data,
            'predictions': results,
            'activeModel': original_type
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/retrain', methods=['POST'])
def retrain():
    """
    Retrain model with new production data (incremental learning)
    """
    try:
        data = request.get_json()
        
        if 'data' not in data or len(data['data']) < 5:
            return jsonify({'error': 'At least 5 data points required for retraining'}), 400
        
        training_data = data['data']
        incremental = data.get('incremental', True)
        
        X = np.array([[
            item['taskSize'],
            item['taskType'],
            item['priority'],
            item['resourceLoad']
        ] for item in training_data])
        
        y = np.array([item['actualTime'] for item in training_data])
        
        metrics = predictor.retrain(X, y, incremental=incremental)
        
        return jsonify({
            'success': True,
            'message': 'Model retrained successfully',
            'metrics': metrics,
            'modelVersion': predictor.get_version(),
            'incremental': incremental
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    
    print(f"🤖 ML Service starting on port {port}")
    print(f"📊 Model: {predictor.model_type} - {predictor.get_version()}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
