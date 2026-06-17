import os
import time
import numpy as np
from flask import Blueprint, request, jsonify
from services.model_manager import model_manager
from utils.shared import safe_error, record_metric, require_api_key

train_bp = Blueprint('train', __name__)

@train_bp.route('/train', methods=['POST'])
@require_api_key
def train():
    predictor = model_manager.get_predictor()
    try:
        data = request.get_json()
        
        if 'data' not in data or len(data['data']) < 10:
            return jsonify({'error': 'At least 10 data points required for training'}), 400
        
        training_data = data['data']
        
        X = []
        y = []
        for item in training_data:
            overhead = item.get('startupOverhead', 1.0)
            X.append([
                item['taskSize'],
                item['taskType'],
                item['priority'],
                item['resourceLoad'],
                overhead
            ])
            y.append(item['actualTime'])
        
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

@train_bp.route('/retrain', methods=['POST'])
@require_api_key
def retrain():
    predictor = model_manager.get_predictor()
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
            item['resourceLoad'],
            item.get('startupOverhead', 1.0)
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

@train_bp.route('/retrain/from-db', methods=['POST'])
@require_api_key
def retrain_from_db():
    predictor = model_manager.get_predictor()
    try:
        data = request.get_json(silent=True) or {}
        model_type = data.get('model_type', predictor.model_type)
        min_samples = int(data.get('min_samples', 20))

        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            return jsonify({'error': 'DATABASE_URL not configured on ML service'}), 503

        if '?' in db_url:
            db_url = db_url.split('?')[0]

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

        X = np.array([[r[0], r[1], r[2], r[3], 1.0] for r in rows])
        y = np.array([r[4] for r in rows])

        if model_type != predictor.model_type:
            predictor.model_type = model_type

        start = time.time()
        metrics = predictor.retrain(X, y, incremental=False)
        train_time = time.time() - start
        record_metric('train_requests_total')
        record_metric('train_latency_sum', train_time)
        record_metric('train_latency_count')

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
        return jsonify({'error': safe_error(e)}), 500

@train_bp.route('/tune', methods=['POST'])
@require_api_key
def tune_hyperparameters():
    predictor = model_manager.get_predictor()
    try:
        from research import HyperparameterTuner, OPTUNA_AVAILABLE as _optuna_ok
        if not _optuna_ok:
            return jsonify({'error': 'Optuna not installed (pip install optuna)'}), 501

        data = request.get_json()
        model_type = data.get('modelType', 'random_forest')
        n_trials = min(int(data.get('nTrials', 50)), 200)

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
