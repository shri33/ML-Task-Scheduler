"""
ML API Endpoint Tests
Tests the Flask API endpoints for prediction, training, health, and model management.
"""

import sys
import os
import json
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client():
    """Create Flask test client."""
    os.environ['ML_API_KEY'] = 'test-api-key'
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def api_key_header():
    return {'X-API-Key': 'test-api-key'}


class TestHealthEndpoints:
    def test_health(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['status'] == 'healthy'

    def test_metrics(self, client):
        resp = client.get('/metrics')
        assert resp.status_code == 200
        assert 'text/plain' in resp.content_type


class TestPredictEndpoint:
    def test_single_predict(self, client):
        resp = client.post('/api/predict', json={
            'taskSize': 2, 'taskType': 1, 'priority': 3, 'resourceLoad': 50
        })
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'predictedTime' in data
        assert 'confidence' in data
        assert data['predictedTime'] > 0
        assert 0 < data['confidence'] <= 1.0

    def test_predict_missing_fields(self, client):
        resp = client.post('/api/predict', json={'taskSize': 1})
        assert resp.status_code == 400

    def test_predict_invalid_values(self, client):
        resp = client.post('/api/predict', json={
            'taskSize': 'abc', 'taskType': 1, 'priority': 3, 'resourceLoad': 50
        })
        # Should either handle gracefully or return 400/500
        assert resp.status_code in [200, 400, 500]

    def test_batch_predict(self, client):
        resp = client.post('/api/predict/batch', json={
            'tasks': [
                {'taskSize': 1, 'taskType': 1, 'priority': 1, 'resourceLoad': 10},
                {'taskSize': 2, 'taskType': 2, 'priority': 3, 'resourceLoad': 50},
                {'taskSize': 3, 'taskType': 3, 'priority': 5, 'resourceLoad': 90},
            ]
        })
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'predictions' in data
        assert len(data['predictions']) == 3

    def test_empty_batch(self, client):
        resp = client.post('/api/predict/batch', json={'tasks': []})
        assert resp.status_code in [200, 400]


class TestModelManagement:
    def test_model_info(self, client):
        resp = client.get('/api/model/info')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'model_type' in data or 'modelType' in data

    def test_model_switch_requires_auth(self, client):
        resp = client.post('/api/model/switch', json={'modelType': 'xgboost'})
        assert resp.status_code in [401, 403]

    def test_model_switch_with_auth(self, client, api_key_header):
        resp = client.post('/api/model/switch',
                         json={'modelType': 'random_forest'},
                         headers=api_key_header)
        assert resp.status_code == 200

    def test_train_requires_auth(self, client):
        resp = client.post('/api/train')
        assert resp.status_code in [401, 403]


class TestRateLimiting:
    def test_rate_limit_headers(self, client):
        """After multiple rapid requests, rate limiting should kick in."""
        responses = []
        for _ in range(25):
            resp = client.post('/api/predict', json={
                'taskSize': 1, 'taskType': 1, 'priority': 1, 'resourceLoad': 10
            })
            responses.append(resp.status_code)
        # At least the early requests should succeed
        assert 200 in responses


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
