"""
Simulation ML Prediction Routes
=================================
Flask blueprint for ML prediction endpoints used by the simulation.
"""

from flask import Blueprint, request, jsonify
import numpy as np
import logging

logger = logging.getLogger(__name__)

simulation_bp = Blueprint('simulation', __name__, url_prefix='/api/simulation')


@simulation_bp.route('/predict/exec-time', methods=['POST'])
def predict_exec_time():
    """Predict task execution time on a target node."""
    try:
        from services.simulation_models import get_model_manager, extract_features

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Missing request body'}), 400

        manager = get_model_manager()
        features = extract_features(
            node_state=data.get('node_state', {}),
            task=data.get('task', {}),
            path_info=data.get('path_info', {}),
            historical=data.get('historical', {}),
        )

        prediction = manager.predict('exec_time', features)

        return jsonify({
            'success': True,
            'data': {
                'predicted_exec_time': prediction,
                'model': 'exec_time',
                'features_used': len(features),
            },
        })
    except Exception as e:
        logger.error(f"Execution time prediction error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@simulation_bp.route('/predict/queue-wait', methods=['POST'])
def predict_queue_wait():
    """Predict queue wait time at a target node."""
    try:
        from services.simulation_models import get_model_manager, extract_features

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Missing request body'}), 400

        manager = get_model_manager()
        features = extract_features(
            node_state=data.get('node_state', {}),
            task=data.get('task', {}),
            path_info=data.get('path_info', {}),
            historical=data.get('historical', {}),
        )

        prediction = manager.predict('queue_wait', features)

        return jsonify({
            'success': True,
            'data': {'predicted_queue_wait': prediction, 'model': 'queue_wait'},
        })
    except Exception as e:
        logger.error(f"Queue wait prediction error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@simulation_bp.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Batch prediction for multiple task-node pairs."""
    try:
        from services.simulation_models import get_model_manager, extract_features

        data = request.get_json()
        if not data or 'items' not in data:
            return jsonify({'success': False, 'error': 'Missing items array'}), 400

        model_name = data.get('model', 'exec_time')
        items = data['items']

        if len(items) > 10000:
            return jsonify({'success': False, 'error': 'Batch size limit: 10000'}), 400

        manager = get_model_manager()

        features_batch = np.array([
            extract_features(
                node_state=item.get('node_state', {}),
                task=item.get('task', {}),
                path_info=item.get('path_info', {}),
                historical=item.get('historical', {}),
            )
            for item in items
        ])

        predictions = manager.predict_batch(model_name, features_batch)

        return jsonify({
            'success': True,
            'data': {
                'predictions': predictions.tolist(),
                'model': model_name,
                'count': len(predictions),
            },
        })
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@simulation_bp.route('/predict/congestion', methods=['POST'])
def predict_congestion():
    """Predict congestion probability at a node."""
    try:
        from services.simulation_models import get_model_manager, extract_features

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Missing request body'}), 400

        manager = get_model_manager()
        features = extract_features(
            node_state=data.get('node_state', {}),
            task=data.get('task', {}),
            path_info=data.get('path_info', {}),
            historical=data.get('historical', {}),
        )

        congestion_prob = manager.predict('congestion', features)
        failure_prob = manager.predict('failure_prob', features)

        return jsonify({
            'success': True,
            'data': {
                'congestion_probability': float(congestion_prob),
                'failure_probability': float(failure_prob),
                'risk_level': 'high' if congestion_prob > 0.7 else 'medium' if congestion_prob > 0.4 else 'low',
            },
        })
    except Exception as e:
        logger.error(f"Congestion prediction error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@simulation_bp.route('/models/info', methods=['GET'])
def model_info():
    """Get information about loaded ML models."""
    try:
        from services.simulation_models import get_model_manager
        manager = get_model_manager()
        info = manager.get_all_model_info()

        return jsonify({
            'success': True,
            'data': info,
        })
    except Exception as e:
        logger.error(f"Model info error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@simulation_bp.route('/models/retrain', methods=['POST'])
def retrain_models():
    """Retrain simulation models with new data."""
    try:
        api_key = request.headers.get('X-API-Key')
        expected_key = __import__('os').environ.get('ML_API_KEY', 'ml-secret-key-change-in-production')
        if api_key != expected_key:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401

        from services.simulation_models import get_model_manager
        manager = get_model_manager()

        # Re-initialize forces retraining
        manager._initialized = False
        manager.initialize()

        return jsonify({
            'success': True,
            'data': {'message': 'All simulation models retrained', 'models': list(manager.models.keys())},
        })
    except Exception as e:
        logger.error(f"Retrain error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
