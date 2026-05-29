import os
import logging
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

_IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production'
ML_API_KEY = os.getenv('ML_API_KEY', '')

def safe_error(e: Exception, fallback: str = 'Internal server error') -> str:
    if _IS_PRODUCTION:
        return fallback
    return str(e)

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not ML_API_KEY:
            logger.warning("ML_API_KEY not configured – rejecting request")
            return jsonify({'error': 'Service not configured for training'}), 503
        api_key = request.headers.get('X-API-Key', '')
        if api_key != ML_API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated

# Simple metrics dictionary
_metrics = {
    'predict_requests_total': 0,
    'predict_latency_sum': 0.0,
    'predict_latency_count': 0,
    'train_requests_total': 0,
    'batch_requests_total': 0,
    'errors_total': 0,
    'batch_tasks_total': 0,
}

def record_metric(name: str, value: float = 1.0):
    _metrics[name] = _metrics.get(name, 0.0) + value

# OpenTelemetry tracer
_tracer = None
try:
    from opentelemetry import trace
    # Only get tracer if a provider is configured
    if trace.get_tracer_provider():
        _tracer = trace.get_tracer("ml-service")
except Exception:
    pass
