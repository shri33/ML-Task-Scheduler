"""
ML Service for Task Scheduling System
Predicts task execution time using Random Forest Regression
"""

import os
import logging
import time
from datetime import datetime
from collections import defaultdict
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
import numpy as np
from functools import wraps
from model import TaskPredictor

load_dotenv()

# ---------------------------------------------------------------------------
# Error sanitization — never leak internal details to clients in production
# ---------------------------------------------------------------------------
_IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production'

def safe_error(e: Exception, fallback: str = 'Internal server error') -> str:
    """Return a sanitized error message.
    In production only the fallback is returned; in dev the real message is shown."""
    if _IS_PRODUCTION:
        return fallback
    return str(e)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [ml-service] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Add file handler for production (only if logs directory can be created)
if os.getenv('FLASK_ENV') == 'production':
    try:
        log_dir = 'logs'
        if not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(f'{log_dir}/ml-service.log')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s [%(levelname)s] [ml-service] %(message)s'
        ))
        logger.addHandler(file_handler)
    except Exception as e:
        logger.warning(f"Could not create file handler for logging: {e}")

# ---------------------------------------------------------------------------
# OpenTelemetry instrumentation (optional — degrades gracefully)
# ---------------------------------------------------------------------------
_tracer = None
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource as OTelResource
    from opentelemetry.instrumentation.flask import FlaskInstrumentor

    otel_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT')
    if otel_endpoint:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        resource = OTelResource.create({"service.name": "ml-service", "service.version": "1.0.0"})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otel_endpoint)))
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer("ml-service")
        logger.info(f"OpenTelemetry tracing enabled → {otel_endpoint}")
    else:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled")
except ImportError:
    logger.info("OpenTelemetry packages not installed — tracing disabled")

app = Flask(__name__)
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
CORS(app, resources={r"/api/*": {"origins": frontend_url}})

# Auto-instrument Flask routes if OTel is available
try:
    from opentelemetry.instrumentation.flask import FlaskInstrumentor
    if _tracer:
        FlaskInstrumentor().instrument_app(app)
        logger.info("Flask auto-instrumented with OpenTelemetry")
except Exception:
    pass

# API key for protected endpoints (train/retrain)
ML_API_KEY = os.getenv('ML_API_KEY', '')

def require_api_key(f):
    """Decorator that requires a valid API key for sensitive endpoints."""
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

# ---------------------------------------------------------------------------
# Simple in-process rate limiter (per-IP, sliding window)
# NOTE: This store is per-process. With Gunicorn's preforked workers,
# each worker maintains its own dict, so the effective rate limit is
# multiplied by the number of workers. For production, consider using
# a shared store (e.g. Redis) or an API gateway (e.g. Nginx, Istio).
# ---------------------------------------------------------------------------
_rate_limit_store: dict = defaultdict(list)
_rate_limit_last_cleanup: float = time.time()
_RATE_LIMIT_CLEANUP_INTERVAL = 300  # purge stale IPs every 5 minutes
RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', '60'))   # seconds
RATE_LIMIT_MAX = int(os.getenv('RATE_LIMIT_MAX', '60'))         # requests per window

def _cleanup_rate_limit_store():
    """Remove IPs with no recent requests to prevent unbounded memory growth."""
    global _rate_limit_last_cleanup
    now = time.time()
    if now - _rate_limit_last_cleanup < _RATE_LIMIT_CLEANUP_INTERVAL:
        return
    _rate_limit_last_cleanup = now
    stale_ips = [ip for ip, ts in _rate_limit_store.items() if not ts or ts[-1] < now - RATE_LIMIT_WINDOW]
    for ip in stale_ips:
        del _rate_limit_store[ip]

def rate_limit(f):
    """Decorator that applies per-IP rate limiting."""
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = request.remote_addr or 'unknown'
        now = time.time()
        # Periodic cleanup of stale IPs
        _cleanup_rate_limit_store()
        # Prune old entries for this IP
        _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if t > now - RATE_LIMIT_WINDOW]
        if len(_rate_limit_store[ip]) >= RATE_LIMIT_MAX:
            return jsonify({'error': 'Rate limit exceeded. Try again later.'}), 429
        _rate_limit_store[ip].append(now)
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Prometheus-compatible /metrics endpoint (no dependency needed)
# ---------------------------------------------------------------------------
_metrics = {
    'predict_requests_total': 0,
    'predict_latency_sum': 0.0,
    'predict_latency_count': 0,
    'train_requests_total': 0,
    'batch_requests_total': 0,
    'errors_total': 0,
}

def record_metric(name: str, value: float = 1.0):
    """Increment a simple counter / accumulator."""
    _metrics[name] = _metrics.get(name, 0) + value

# Request logging middleware
@app.before_request
def log_request():
    g.start_time = datetime.now()
    logger.info(f"Request: {request.method} {request.path}")

@app.after_request
def log_response(response):
    duration = (datetime.now() - g.start_time).total_seconds() * 1000
    logger.info(f"Response: {request.method} {request.path} {response.status_code} {duration:.2f}ms")
    return response

# Initialize model
predictor = TaskPredictor()
logger.info(f"Model initialized: {predictor.model_type} - {predictor.get_version()}")

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
@rate_limit
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
        start = time.time()
        # Wrap in OTel span if available
        if _tracer:
            with _tracer.start_as_current_span("ml.predict", attributes={
                "ml.task_size": task_size, "ml.task_type": task_type,
                "ml.priority": priority, "ml.resource_load": resource_load,
            }) as span:
                predicted_time, confidence = predictor.predict(
                    task_size, task_type, priority, resource_load
                )
                span.set_attribute("ml.predicted_time", predicted_time)
                span.set_attribute("ml.confidence", confidence)
        else:
            predicted_time, confidence = predictor.predict(
                task_size, task_type, priority, resource_load
            )
        latency = time.time() - start
        record_metric('predict_requests_total')
        record_metric('predict_latency_sum', latency)
        record_metric('predict_latency_count')
        
        return jsonify({
            'predictedTime': round(predicted_time, 2),
            'confidence': round(confidence, 4),
            'modelVersion': predictor.get_version()
        })
        
    except Exception as e:
        record_metric('errors_total')
        return jsonify({'error': safe_error(e)}), 500

@app.route('/api/predict/batch', methods=['POST'])
@rate_limit
def predict_batch():
    """
    Batch prediction for multiple tasks at once
    
    Request body:
    {
        "tasks": [
            {
                "taskId": "optional-id",
                "taskSize": 1-3,
                "taskType": 1-3,
                "priority": 1-5,
                "resourceLoad": 0-100
            },
            ...
        ]
    }
    
    Response:
    {
        "predictions": [
            {
                "taskId": "optional-id",
                "predictedTime": float,
                "confidence": float
            },
            ...
        ],
        "totalTasks": int,
        "avgPredictedTime": float,
        "modelVersion": string
    }
    """
    try:
        data = request.get_json()
        
        if 'tasks' not in data or not isinstance(data['tasks'], list):
            return jsonify({'error': 'Missing "tasks" array in request body'}), 400
        
        if len(data['tasks']) == 0:
            return jsonify({'error': 'Empty tasks array'}), 400
        
        if len(data['tasks']) > 1000:
            return jsonify({'error': 'Maximum 1000 tasks per batch request'}), 400
        
        predictions = []
        total_time = 0
        errors = []
        
        # Validate all tasks first, collect valid features for vectorized prediction
        valid_tasks = []  # (index, taskId_or_None, features)
        
        for idx, task in enumerate(data['tasks']):
            try:
                required_fields = ['taskSize', 'taskType', 'priority', 'resourceLoad']
                missing = [f for f in required_fields if f not in task]
                if missing:
                    errors.append({'index': idx, 'error': f'Missing fields: {missing}'})
                    continue
                
                task_size = int(task['taskSize'])
                task_type = int(task['taskType'])
                priority = int(task['priority'])
                resource_load = float(task['resourceLoad'])
                
                if task_size not in [1, 2, 3]:
                    errors.append({'index': idx, 'error': 'taskSize must be 1, 2, or 3'})
                    continue
                if task_type not in [1, 2, 3]:
                    errors.append({'index': idx, 'error': 'taskType must be 1, 2, or 3'})
                    continue
                if not 1 <= priority <= 5:
                    errors.append({'index': idx, 'error': 'priority must be between 1 and 5'})
                    continue
                if not 0 <= resource_load <= 100:
                    errors.append({'index': idx, 'error': 'resourceLoad must be between 0 and 100'})
                    continue
                
                valid_tasks.append((idx, task.get('taskId'), [task_size, task_type, priority, resource_load]))
                
            except Exception as e:
                errors.append({'index': idx, 'error': safe_error(e)})
        
        # Vectorized batch prediction — single NumPy call instead of N serial calls
        if valid_tasks:
            features = [vt[2] for vt in valid_tasks]
            batch_results = predictor.predict_batch(features)
            
            for (idx, task_id, _feats), (predicted_time, confidence) in zip(valid_tasks, batch_results):
                prediction_result = {
                    'predictedTime': round(predicted_time, 2),
                    'confidence': round(confidence, 4)
                }
                if task_id is not None:
                    prediction_result['taskId'] = task_id
                predictions.append(prediction_result)
                total_time += predicted_time
        
        record_metric('batch_requests_total')
        record_metric('batch_tasks_total', len(predictions))

        response = {
            'predictions': predictions,
            'totalTasks': len(predictions),
            'avgPredictedTime': round(total_time / len(predictions), 2) if predictions else 0,
            'modelVersion': predictor.get_version()
        }
        
        if errors:
            response['errors'] = errors
            response['errorCount'] = len(errors)
        
        return jsonify(response)
        
    except Exception as e:
        record_metric('errors_total')
        return jsonify({'error': safe_error(e)}), 500

@app.route('/api/train', methods=['POST'])
@require_api_key
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
        start = time.time()
        metrics = predictor.train(np.array(X), np.array(y))
        record_metric('train_requests_total')
        record_metric('train_latency_sum', time.time() - start)
        record_metric('train_latency_count')
        
        return jsonify({
            'success': True,
            'message': 'Model trained successfully',
            'metrics': metrics,
            'modelVersion': predictor.get_version()
        })
        
    except Exception as e:
        record_metric('errors_total')
        return jsonify({'error': safe_error(e)}), 500

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


@app.route('/api/model/registry', methods=['GET'])
def model_registry():
    """
    Lightweight model registry — lists all trained model versions
    with their metadata, metrics, and training configuration.
    Acts as a simple MLflow alternative for model versioning.

    Response:
    {
        "activeVersion": "v20260308...",
        "activeModelType": "xgboost",
        "versions": [
            {
                "version": "v20260308...",
                "trainedAt": "2026-03-08T...",
                "modelType": "xgboost",
                "dataSource": "synthetic",
                "samples": 2000,
                "metrics": { "r2_score": 0.95, "mae": 0.45, ... }
            },
            ...
        ],
        "totalVersions": int
    }
    """
    import json as json_mod
    metadata_dir = os.path.join(os.path.dirname(__file__), 'models', 'metadata')
    versions = []

    if os.path.exists(metadata_dir):
        for fname in sorted(os.listdir(metadata_dir), reverse=True):
            if fname.endswith('.json'):
                try:
                    with open(os.path.join(metadata_dir, fname), 'r') as f:
                        meta = json_mod.load(f)
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
        return jsonify({'error': safe_error(e)}), 400
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500

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
        
        results = {}
        model_types = ['random_forest', 'gradient_boosting']
        
        # Try XGBoost if available
        try:
            import xgboost
            model_types.append('xgboost')
        except ImportError:
            pass
        
        # Use isolated predictor instances to avoid mutating global state.
        # Each gets a unique model_path so _load_or_create_model trains the
        # correct model type rather than loading the global model from disk.
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

@app.route('/api/retrain', methods=['POST'])
@require_api_key
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
        
        start = time.time()
        metrics = predictor.retrain(X, y, incremental=incremental)
        record_metric('train_requests_total')
        record_metric('train_latency_sum', time.time() - start)
        record_metric('train_latency_count')
        
        return jsonify({
            'success': True,
            'message': 'Model retrained successfully',
            'metrics': metrics,
            'modelVersion': predictor.get_version(),
            'incremental': incremental
        })
        
    except Exception as e:
        record_metric('errors_total')
        return jsonify({'error': safe_error(e)}), 500


@app.route('/api/retrain/from-db', methods=['POST'])
@require_api_key
def retrain_from_db():
    """
    Pull real completed task data from PostgreSQL and retrain the model.
    This is the production endpoint for real-world device integration.

    When real IoT devices (cameras, sensors, robot arms, edge servers) 
    complete tasks, the backend stores actualTime in the database.
    This endpoint reads that data and retrains the model to be accurate
    for your specific hardware and environment.

    Optional request body:
    {
        "model_type": "xgboost" | "random_forest" | "gradient_boosting",
        "min_samples": 20     // minimum rows required to retrain (default 20)
    }

    Response:
    {
        "success": true,
        "dataSource": "postgresql",
        "rowsUsed": int,
        "metrics": { "r2_score": ..., "samples_trained": ... },
        "modelVersion": "v..."
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        model_type = data.get('model_type', predictor.model_type)
        min_samples = int(data.get('min_samples', 20))

        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            return jsonify({'error': 'DATABASE_URL not configured on ML service'}), 503

        # Strip Prisma-specific query params (?schema=public) that psycopg2 doesn't understand
        if '?' in db_url:
            db_url = db_url.split('?')[0]

        # Connect to PostgreSQL and pull real completed tasks
        try:
            import psycopg2
        except ImportError:
            return jsonify({'error': 'psycopg2 not installed in ML service container'}), 503

        try:
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    CASE t.size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END AS "taskSize",
                    CASE t.type WHEN 'CPU' THEN 1 WHEN 'IO' THEN 2 ELSE 3 END AS "taskType",
                    t.priority,
                    COALESCE(r."currentLoad", 50) AS "resourceLoad",
                    t."actualTime"
                FROM "Task" t
                LEFT JOIN "Resource" r ON t."resourceId" = r.id
                WHERE t."actualTime" IS NOT NULL
                  AND t."deletedAt" IS NULL
                ORDER BY t."completedAt" DESC
            """)
            rows = cursor.fetchall()
            conn.close()
        except Exception as db_err:
            logger.error(f"Database query failed: {db_err}")
            return jsonify({
                'error': f'Failed to query database: {safe_error(db_err)}',
                'hint': 'Make sure DATABASE_URL points to the correct PostgreSQL instance'
            }), 503

        if len(rows) < min_samples:
            return jsonify({
                'error': f'Not enough real data to retrain. Found {len(rows)} completed tasks, need at least {min_samples}.',
                'hint': 'Complete more tasks with real devices, then try again.',
                'currentRows': len(rows),
                'requiredRows': min_samples
            }), 400

        # Convert to numpy arrays
        import numpy as np_local
        X = np_local.array([[r[0], r[1], r[2], r[3]] for r in rows])
        y = np_local.array([r[4] for r in rows])

        logger.info(f"Retraining on {len(rows)} real completed tasks from PostgreSQL")

        # Switch model type if requested
        if model_type != predictor.model_type:
            predictor.model_type = model_type

        # Retrain with real production data
        start = time.time()
        metrics = predictor.retrain(X, y, incremental=False)
        train_time = time.time() - start
        record_metric('train_requests_total')
        record_metric('train_latency_sum', train_time)
        record_metric('train_latency_count')

        logger.info(f"Retrained on real data: R²={metrics['r2_score']}, {len(rows)} samples, {train_time:.2f}s")

        return jsonify({
            'success': True,
            'message': f'Model retrained on {len(rows)} real completed tasks from PostgreSQL',
            'dataSource': 'postgresql',
            'rowsUsed': len(rows),
            'trainingTimeSeconds': round(train_time, 2),
            'metrics': metrics,
            'modelVersion': predictor.get_version()
        })

    except Exception as e:
        record_metric('errors_total')
        logger.error(f"Retrain from DB failed: {e}")
        return jsonify({'error': safe_error(e)}), 500

@app.route('/metrics', methods=['GET'])
def prometheus_metrics():
    """Prometheus-compatible metrics endpoint."""
    lines = []
    for key, val in _metrics.items():
        prom_name = f'ml_service_{key}'
        lines.append(f'# TYPE {prom_name} counter')
        lines.append(f'{prom_name} {val}')
    return '\n'.join(lines) + '\n', 200, {'Content-Type': 'text/plain; charset=utf-8'}

# ---------------------------------------------------------------------------
# Research-Grade Endpoints
# ---------------------------------------------------------------------------

@app.route('/api/explain', methods=['POST'])
def explain_prediction():
    """
    SHAP-based explanation for a single prediction.

    Request body: { "taskSize": 1-3, "taskType": 1-3, "priority": 1-5, "resourceLoad": 0-100 }
    Response: { "predictedTime": ..., "shapValues": { feature: contribution }, ... }
    """
    try:
        from research import SHAPExplainer, SHAP_AVAILABLE as _shap_ok
        if not _shap_ok:
            return jsonify({'error': 'SHAP not installed (pip install shap)'}), 501

        data = request.get_json()
        X_single = np.array([[data['taskSize'], data['taskType'], data['priority'], data['resourceLoad']]])
        pred_time, confidence = predictor.predict(*X_single[0])

        # Build background set from synthetic data for SHAP
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


@app.route('/api/predict/interval', methods=['POST'])
def predict_with_interval():
    """
    Prediction with conformal prediction intervals.

    Request body: same as /api/predict + optional "alpha" (default 0.1 → 90% coverage)
    Response: { "predictedTime": ..., "lower": ..., "upper": ..., "coverage": ... }
    """
    try:
        from research import ConformalPredictor
        data = request.get_json()
        alpha = float(data.get('alpha', 0.1))

        X_single = np.array([[data['taskSize'], data['taskType'], data['priority'], data['resourceLoad']]])

        # Calibrate on synthetic validation data
        X_all, y_all = predictor._generate_synthetic_data(500)
        from sklearn.model_selection import train_test_split
        _, X_cal, _, y_cal = train_test_split(X_all, y_all, test_size=0.3, random_state=42)

        cp = ConformalPredictor(predictor.model, alpha=alpha)
        cp.calibrate(X_cal, y_cal)

        intervals = cp.predict_interval(X_single)
        lower, upper = intervals[0]
        pred_time, confidence = predictor.predict(*X_single[0])

        return jsonify({
            'predictedTime': round(pred_time, 2),
            'confidence': round(confidence, 4),
            'lower': round(lower, 2),
            'upper': round(upper, 2),
            'intervalWidth': round(upper - lower, 2),
            'coverage': f'{(1 - alpha) * 100:.0f}%',
            'modelVersion': predictor.get_version(),
        })
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500


@app.route('/api/tune', methods=['POST'])
@require_api_key
def tune_hyperparameters():
    """
    Run Optuna hyperparameter tuning.

    Request body: { "modelType": "random_forest", "nTrials": 50 }
    Response: { "bestParams": {...}, "bestR2": float }
    """
    try:
        from research import HyperparameterTuner, OPTUNA_AVAILABLE as _optuna_ok
        if not _optuna_ok:
            return jsonify({'error': 'Optuna not installed (pip install optuna)'}), 501

        data = request.get_json()
        model_type = data.get('modelType', 'random_forest')
        n_trials = min(int(data.get('nTrials', 50)), 200)  # Cap at 200

        # Use available training data or synthetic
        X, y = predictor._generate_synthetic_data(1000)

        tuner = HyperparameterTuner(X, y)
        best_params, best_r2 = tuner.tune(model_type=model_type, n_trials=n_trials)

        return jsonify({
            'success': True,
            'modelType': model_type,
            'bestParams': best_params,
            'bestR2': round(best_r2, 4),
            'nTrials': n_trials,
        })
    except Exception as e:
        return jsonify({'error': safe_error(e)}), 500

@app.route('/api/predict/rl', methods=['POST'])
@rate_limit
def predict_rl():
    """
    RL-based scheduling: given a list of tasks, return the order in which
    the PPO agent would schedule them (greedy, deterministic).

    Request body:
    {
        "tasks": [
            {
                "taskId": "string",
                "taskSize": 1-3,
                "taskType": 1-3,
                "priority": 1-5,
                "resourceLoad": 0-100,
                "dueDate": float | null   // seconds from now, null = no deadline
            },
            ...
        ],
        "userProfile": {                 // optional
            "avgCompletionRate": 0-1,
            "avgLateness": float,         // seconds
            "productivityPattern": 0|0.5|1,
            "preferredWorkTime": 0-1
        }
    }

    Response:
    {
        "schedulingOrder": ["taskId1", "taskId2", ...],   // priority-highest first
        "modelVersion": "ppo_v1",
        "agentUsed": true | false          // false = fallback to priority sort
    }
    """
    RL_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'ppo_scheduler_final.zip')

    try:
        data = request.get_json(silent=True) or {}
        tasks_raw = data.get('tasks', [])

        if not tasks_raw or not isinstance(tasks_raw, list):
            return jsonify({'error': 'Missing or empty "tasks" array'}), 400

        if len(tasks_raw) > 50:
            return jsonify({'error': 'Maximum 50 tasks per RL scheduling request'}), 400

        # Validate required fields
        for i, t in enumerate(tasks_raw):
            for field in ('taskId', 'taskSize', 'taskType', 'priority', 'resourceLoad'):
                if field not in t:
                    return jsonify({'error': f'Task[{i}] missing field: {field}'}), 400

        task_ids = [t['taskId'] for t in tasks_raw]

        # Attempt RL agent scheduling
        model_loaded = False
        if os.path.exists(RL_MODEL_PATH):
            try:
                from sb3_contrib import MaskablePPO
                from environments.scheduling_env import AdvancedSchedulingEnv, RLTask
                import gymnasium as gym

                max_tasks = 50  # must match training env
                user_raw = data.get('userProfile', {})
                user_profile = {
                    'avg_completion_rate': float(user_raw.get('avgCompletionRate', 0.85)),
                    'avg_lateness': float(user_raw.get('avgLateness', 300.0)),
                    'productivity_pattern': float(user_raw.get('productivityPattern', 0.0)),
                    'preferred_work_time': float(user_raw.get('preferredWorkTime', 0.5)),
                }

                # Build env and inject tasks so agent can be stepped
                env = AdvancedSchedulingEnv(max_tasks=max_tasks, seed=42)
                obs, _ = env.reset(seed=42)

                # Replace env tasks with the real incoming tasks (padded to max_tasks)
                now = 0.0
                time_horizon = env.time_horizon

                from environments.scheduling_env import RLTask as _RLTask
                injected: list = []
                for i in range(max_tasks):
                    if i < len(tasks_raw):
                        t = tasks_raw[i]
                        # Map taskType 1-3 → 0-2 for env
                        task_type = int(t['taskType']) - 1  # env uses 0,1,2
                        priority_norm = (int(t['priority']) - 1) / 4.0  # 0-1
                        # estimated duration: use simple heuristic from size/type
                        size_s = {1: 60.0, 2: 180.0, 3: 420.0}
                        est_dur = size_s.get(int(t['taskSize']), 180.0)
                        due_date = float(t.get('dueDate') or (est_dur + 1800.0))  # 30 min slack default
                        rl_t = _RLTask(
                            id=i,
                            task_type=task_type,
                            priority=priority_norm,
                            deadline=due_date,
                            estimated_duration=est_dur,
                            predicted_duration=est_dur,
                            predicted_success_prob=0.85,
                            created_at=now,
                        )
                        injected.append(rl_t)
                    else:
                        # Padding: already completed dummy
                        injected.append(_RLTask(
                            id=i, task_type=-1, priority=0, estimated_duration=0,
                            predicted_duration=0, predicted_success_prob=0,
                            deadline=0, created_at=0, is_completed=True
                        ))
                env.tasks = injected

                from dataclasses import replace as _replace
                from environments.scheduling_env import RLUserEmbedding as _RLUEmb
                env.user_data = _RLUEmb(**user_profile)

                # Rebuild observation after injecting tasks
                obs = env._get_obs()

                agent = MaskablePPO.load(RL_MODEL_PATH, device='cpu')
                scheduling_order_indices: list[int] = []
                remaining = set(range(len(tasks_raw)))

                # Step agent greedily for len(tasks_raw) steps
                for _ in range(len(tasks_raw)):
                    mask = obs['mask'].astype(bool)
                    if not mask.any():
                        break
                    action, _ = agent.predict(obs, action_masks=mask, deterministic=True)
                    action = int(action)
                    if action in remaining:
                        scheduling_order_indices.append(action)
                        remaining.discard(action)
                    # step env to update obs
                    obs, _, terminated, _, _ = env.step(action)
                    if terminated:
                        break

                # Any tasks the agent didn't visit get appended by priority
                leftover = sorted(remaining, key=lambda i: -tasks_raw[i]['priority'])
                scheduling_order_indices.extend(leftover)

                scheduling_order = [task_ids[i] for i in scheduling_order_indices]
                model_loaded = True
                logger.info(f'RL agent scheduled {len(scheduling_order)} tasks')

            except Exception as rl_err:
                logger.warning(f'RL agent failed, using fallback: {rl_err}')
                model_loaded = False

        if not model_loaded:
            # Fallback: sort by priority desc, then by deadline asc (EDF-style)
            def _sort_key(t):
                due = t.get('dueDate') or float('inf')
                return (-int(t['priority']), due)

            sorted_tasks = sorted(tasks_raw, key=_sort_key)
            scheduling_order = [t['taskId'] for t in sorted_tasks]

        return jsonify({
            'schedulingOrder': scheduling_order,
            'modelVersion': 'ppo_v1' if model_loaded else 'fallback-priority',
            'agentUsed': model_loaded,
            'taskCount': len(scheduling_order),
        })

    except Exception as e:
        record_metric('errors_total')
        logger.error(f'RL predict endpoint error: {e}')
        return jsonify({'error': safe_error(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    
    print(f"🤖 ML Service starting on port {port}")
    print(f"📊 Model: {predictor.model_type} - {predictor.get_version()}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
