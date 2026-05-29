import os
import time
import numpy as np
from flask import Blueprint, request, jsonify
from services.model_manager import model_manager
from utils.limiter import limiter
from utils.shared import safe_error, record_metric, _tracer

predict_bp = Blueprint('predict', __name__)

# Enums mapping
size_map = { 'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3 }
type_map = { 'CPU': 1, 'IO': 2, 'MIXED': 3 }

@predict_bp.route('/predict', methods=['POST'])
@limiter.limit("60 per minute")
def predict():
    predictor = model_manager.get_predictor()
    try:
        data = request.get_json()
        
        required_fields = ['taskSize', 'taskType', 'priority', 'resourceLoad']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        task_size = int(data['taskSize'])
        task_type = int(data['taskType'])
        priority = int(data['priority'])
        resource_load = float(data['resourceLoad'])
        startup_overhead = float(data.get('startupOverhead', 1.0))
        
        if task_size not in [1, 2, 3]:
            return jsonify({'error': 'taskSize must be 1, 2, or 3'}), 400
        if task_type not in [1, 2, 3]:
            return jsonify({'error': 'taskType must be 1, 2, or 3'}), 400
        if not 1 <= priority <= 5:
            return jsonify({'error': 'priority must be between 1 and 5'}), 400
        if not 0 <= resource_load <= 100:
            return jsonify({'error': 'resourceLoad must be between 0 and 100'}), 400
        
        start = time.time()
        if _tracer:
            with _tracer.start_as_current_span("ml.predict", attributes={
                "ml.task_size": task_size, "ml.task_type": task_type,
                "ml.priority": priority, "ml.resource_load": resource_load,
            }) as span:
                predicted_time, confidence = predictor.predict(
                    task_size, task_type, priority, resource_load, startup_overhead
                )
                span.set_attribute("ml.predicted_time", predicted_time)
                span.set_attribute("ml.confidence", confidence)
        else:
            predicted_time, confidence = predictor.predict(
                task_size, task_type, priority, resource_load, startup_overhead
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

@predict_bp.route('/predict/batch', methods=['POST'])
@limiter.limit("60 per minute")
def predict_batch():
    predictor = model_manager.get_predictor()
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
        valid_tasks = []
        
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
                
                startup_overhead = float(task.get('startupOverhead', 1.0))
                valid_tasks.append((idx, task.get('taskId'), [task_size, task_type, priority, resource_load, startup_overhead]))
                
            except Exception as e:
                errors.append({'index': idx, 'error': safe_error(e)})
        
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

@predict_bp.route('/predict/interval', methods=['POST'])
def predict_with_interval():
    predictor = model_manager.get_predictor()
    try:
        from research import ConformalPredictor
        data = request.get_json()
        alpha = float(data.get('alpha', 0.1))

        X_single = np.array([[data['taskSize'], data['taskType'], data['priority'], data['resourceLoad']]])

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

@predict_bp.route('/predict/rl', methods=['POST'])
@limiter.limit("60 per minute")
def predict_rl():
    ml_root = os.path.dirname(os.path.dirname(__file__))
    RL_MODEL_PATH = os.path.join(ml_root, 'models', 'ppo_scheduler_final.zip')

    try:
        data = request.get_json(silent=True) or {}
        tasks_raw = data.get('tasks', [])

        if not tasks_raw or not isinstance(tasks_raw, list):
            return jsonify({'error': 'Missing or empty "tasks" array'}), 400

        if len(tasks_raw) > 50:
            return jsonify({'error': 'Maximum 50 tasks per RL scheduling request'}), 400

        for i, t in enumerate(tasks_raw):
            for field in ('taskId', 'taskSize', 'taskType', 'priority', 'resourceLoad'):
                if field not in t:
                    return jsonify({'error': f'Task[{i}] missing field: {field}'}), 400

        task_ids = [t['taskId'] for t in tasks_raw]

        model_loaded = False
        if os.path.exists(RL_MODEL_PATH):
            try:
                from sb3_contrib import MaskablePPO
                from environments.scheduling_env import AdvancedSchedulingEnv, RLTask
                import gymnasium as gym

                max_tasks = 50
                user_raw = data.get('userProfile', {})
                user_profile = {
                    'avg_completion_rate': float(user_raw.get('avgCompletionRate', 0.85)),
                    'avg_lateness': float(user_raw.get('avgLateness', 300.0)),
                    'productivity_pattern': float(user_raw.get('productivityPattern', 0.0)),
                    'preferred_work_time': float(user_raw.get('preferredWorkTime', 0.5)),
                }

                env = AdvancedSchedulingEnv(max_tasks=max_tasks, seed=42)
                obs, _ = env.reset(seed=42)

                injected = []
                for i in range(max_tasks):
                    if i < len(tasks_raw):
                        t = tasks_raw[i]
                        task_type = int(t['taskType']) - 1
                        priority_norm = (int(t['priority']) - 1) / 4.0
                        size_s = {1: 60.0, 2: 180.0, 3: 420.0}
                        est_dur = size_s.get(int(t['taskSize']), 180.0)
                        due_date = float(t.get('dueDate') or (est_dur + 1800.0))
                        rl_t = RLTask(
                            id=i,
                            task_type=task_type,
                            priority=priority_norm,
                            deadline=due_date,
                            estimated_duration=est_dur,
                            predicted_duration=est_dur,
                            predicted_success_prob=0.85,
                            created_at=0.0,
                        )
                        injected.append(rl_t)
                    else:
                        injected.append(RLTask(
                            id=i, task_type=-1, priority=0, estimated_duration=0,
                            predicted_duration=0, predicted_success_prob=0,
                            deadline=0, created_at=0, is_completed=True
                        ))
                env.tasks = injected

                from environments.scheduling_env import RLUserEmbedding
                env.user_data = RLUserEmbedding(**user_profile)
                obs = env._get_obs()

                agent = MaskablePPO.load(RL_MODEL_PATH, device='cpu')
                scheduling_order_indices = []
                remaining = set(range(len(tasks_raw)))

                for _ in range(len(tasks_raw)):
                    mask = obs['mask'].astype(bool)
                    if not mask.any():
                        break
                    action, _ = agent.predict(obs, action_masks=mask, deterministic=True)
                    action = int(action)
                    if action in remaining:
                        scheduling_order_indices.append(action)
                        remaining.discard(action)
                    obs, _, terminated, _, _ = env.step(action)
                    if terminated:
                        break

                leftover = sorted(remaining, key=lambda i: -tasks_raw[i]['priority'])
                scheduling_order_indices.extend(leftover)

                scheduling_order = [task_ids[i] for i in scheduling_order_indices]
                model_loaded = True

            except Exception as rl_err:
                model_loaded = False

        if not model_loaded:
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
        return jsonify({'error': safe_error(e)}), 500
