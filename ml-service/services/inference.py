from services.model_manager import model_manager

def predict_execution_time(task_size, task_type, priority, resource_load, startup_overhead=1.0):
    predictor = model_manager.get_predictor()
    return predictor.predict(task_size, task_type, priority, resource_load, startup_overhead)

def predict_batch_execution_time(features_list):
    predictor = model_manager.get_predictor()
    return predictor.predict_batch(features_list)
