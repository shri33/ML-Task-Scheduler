import os
import threading
import time
import logging
from model import TaskPredictor

logger = logging.getLogger(__name__)

class ModelManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, model_path='models/task_predictor.joblib', model_type='random_forest'):
        with self._lock:
            if self._initialized:
                return
            self.model_path = model_path
            self.model_type = model_type
            self.predictor = TaskPredictor(model_path=model_path, model_type=model_type)
            self._initialized = True
            
            # Start background thread to check for model updates on disk
            self._stop_event = threading.Event()
            self._watcher_thread = threading.Thread(target=self._watch_model_updates, daemon=True)
            self._watcher_thread.start()
            logger.info("ModelManager initialized. Background update watcher started.")

    def _watch_model_updates(self):
        while not self._stop_event.is_set():
            time.sleep(30)
            try:
                updated = self.predictor.check_for_updates()
                if updated:
                    logger.info(f"Model successfully reloaded. New version: {self.predictor.get_version()}")
            except Exception as e:
                logger.error(f"Error in background model watcher: {e}")

    def get_predictor(self) -> TaskPredictor:
        return self.predictor

    def stop_watcher(self):
        self._stop_event.set()

# Singleton instance
model_manager = ModelManager()
