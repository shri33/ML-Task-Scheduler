from flask import Blueprint, jsonify
from services.model_manager import model_manager
from utils.shared import _metrics

health_bp = Blueprint('health', __name__)

@health_bp.route('/api/health', methods=['GET'])
def health_check():
    predictor = model_manager.get_predictor()
    is_ready = predictor.is_loaded()
    
    return jsonify({
        'status': 'ok' if is_ready else 'loading',
        'service': 'ml-prediction-service',
        'model_loaded': is_ready,
        'model_version': predictor.get_version()
    }), 200 if is_ready else 503

@health_bp.route('/metrics', methods=['GET'])
def metrics():
    lines = []
    for name, value in _metrics.items():
        lines.append(f"# HELP ml_{name} ML service metric: {name}")
        lines.append(f"# TYPE ml_{name} counter" if "total" in name else f"# TYPE ml_{name} gauge")
        lines.append(f"ml_{name} {value}")
    return "\n".join(lines) + "\n", 200, {'Content-Type': 'text/plain; version=0.0.4'}
