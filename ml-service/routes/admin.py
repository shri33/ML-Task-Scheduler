import os
import json
import numpy as np
from flask import Blueprint, request, jsonify
from services.model_manager import model_manager
from utils.shared import safe_error, record_metric, require_api_key

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/explain', methods=['POST'])
def explain_prediction():
    predictor = model_manager.get_predictor()
    try:
        from research import SHAPExplainer, SHAP_AVAILABLE as _shap_ok
        if not _shap_ok:
            return jsonify({'error': 'SHAP not installed (pip install shap)'}), 501

        data = request.get_json()
        X_single = np.array([[data['taskSize'], data['taskType'], data['priority'], data['resourceLoad']]])
        pred_time, confidence = predictor.predict(*X_single[0])

        X_bg, _ = predictor._generate_synthetic_data(200)
        explainer = SHAPExplainer(predictor.model, X_bg)
        shap_vals = explainer.single_explanation(X_single[0])

        return jsonify({
            'predictedTime': round(pred_time, 2),
            'confidence': round(confidence, 4),
            'shapValues': shap_vals,
            'modelVersion': predictor.get_version(),
        })
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500

@admin_bp.route('/compare', methods=['POST'])
def compare_models():
    predictor = model_manager.get_predictor()
    try:
        data = request.get_json()
        
        task_size = int(data['taskSize'])
        task_type = int(data['taskType'])
        priority = int(data['priority'])
        resource_load = float(data['resourceLoad'])
        
        results = {}
        model_types = ['random_forest', 'gradient_boosting']
        
        try:
            import xgboost
            model_types.append('xgboost')
        except ImportError:
            pass
        
        from model import TaskPredictor
        for model_type in model_types:
            try:
                temp_predictor = TaskPredictor(
                    model_path=f'models/compare_{model_type}.joblib',
                    model_type=model_type,
                )
                pred_time, confidence = temp_predictor.predict(task_size, task_type, priority, resource_load)
                results[model_type] = {
                    'predictedTime': round(pred_time, 2),
                    'confidence': round(confidence, 4)
                }
            except Exception as e:
                results[model_type] = {'error': safe_error(e)}
        
        return jsonify({
            'success': True,
            'input': data,
            'predictions': results,
            'activeModel': predictor.model_type
        })
        
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500

@admin_bp.route('/anomalies', methods=['POST'])
def detect_anomalies():
    predictor = model_manager.get_predictor()
    try:
        data = request.get_json()
        if 'tasks' not in data or not isinstance(data['tasks'], list):
            return jsonify({'error': 'Missing "tasks" array'}), 400
        
        contamination = float(data.get('contamination', 0.05))
        tasks = data['tasks']
        
        if not tasks:
            return jsonify({'anomalies': [], 'count': 0})

        X = []
        actual_times = []
        for t in tasks:
            X.append([
                int(t['taskSize']),
                int(t['taskType']),
                int(t['priority']),
                float(t['resourceLoad']),
                float(t.get('startupOverhead', 1.0))
            ])
            actual_times.append(float(t['actualTime']))
        
        anomaly_indices = predictor.detect_anomalies(np.array(X), np.array(actual_times), contamination)
        
        results = []
        for idx in anomaly_indices:
            task_info = tasks[idx]
            results.append({
                'index': idx,
                'taskId': task_info.get('taskId'),
                'actualTime': task_info['actualTime'],
                'features': {
                    'size': task_info['taskSize'],
                    'type': task_info['taskType'],
                    'load': task_info['resourceLoad']
                }
            })
            
        return jsonify({
            'anomalies': results,
            'count': len(results),
            'totalProcessed': len(tasks),
            'contamination': contamination,
            'modelVersion': predictor.get_version()
        })
        
    except Exception as e:
        record_metric('errors_total')
        return jsonify({'error': safe_error(e)}), 500

@admin_bp.route('/model/info', methods=['GET'])
def model_info():
    predictor = model_manager.get_predictor()
    return jsonify({
        'modelVersion': predictor.get_version(),
        'modelType': predictor.model_type,
        'isLoaded': predictor.is_loaded(),
        'features': ['taskSize', 'taskType', 'priority', 'resourceLoad'],
        'availableModels': ['random_forest', 'xgboost', 'gradient_boosting'],
        'description': 'Predicts task execution time based on task characteristics and resource load'
    })

@admin_bp.route('/model/registry', methods=['GET'])
def model_registry():
    predictor = model_manager.get_predictor()
    metadata_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'metadata')
    versions = []

    if os.path.exists(metadata_dir):
        for fname in sorted(os.listdir(metadata_dir), reverse=True):
            if fname.endswith('.json'):
                try:
                    with open(os.path.join(metadata_dir, fname), 'r') as f:
                        meta = json.load(f)
                    versions.append({
                        'version': meta.get('version', fname.replace('.json', '')),
                        'trainedAt': meta.get('trained_at', ''),
                        'modelType': meta.get('model_type', 'unknown'),
                        'dataSource': meta.get('data_source', 'unknown'),
                        'samples': meta.get('training_samples', 0),
                        'metrics': meta.get('cross_validation', meta.get('metrics', {})),
                        'features': meta.get('feature_names', []),
                    })
                except Exception:
                    continue

    return jsonify({
        'activeVersion': predictor.get_version(),
        'activeModelType': predictor.model_type,
        'versions': versions,
        'totalVersions': len(versions),
    })

@admin_bp.route('/model/switch', methods=['POST'])
@require_api_key
def switch_model():
    predictor = model_manager.get_predictor()
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
        return jsonify({'error': safe_error(e)}), 400
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500
